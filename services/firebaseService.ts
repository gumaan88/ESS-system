import { db, firebaseConfig } from './firebaseConfig';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
    doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, 
    serverTimestamp, Timestamp, runTransaction, updateDoc, setDoc 
} from 'firebase/firestore';
import { Employee, ServiceDefinition, Request, RequestStatus, ApprovalStepType, FieldType, SystemRole } from '../types';

// --- الثوابت (Hardcoded Services) ---

export const PERMISSION_SERVICE_DEF: ServiceDefinition = {
    id: 'permission_request',
    title: 'طلب إذن',
    icon: '⏱️',
    color: 'indigo-500',
    fields: [
        { id: 'date', label: 'تاريخ الإذن', type: FieldType.DATE, required: true },
        { id: 'reason', label: 'سبب الإذن', type: FieldType.TEXTAREA, required: true }
    ],
    approvalSteps: [
        { order: 1, type: ApprovalStepType.REPORTS_TO, roleValue: null }
    ]
};

// --- عمليات القراءة (Read Operations) ---

export const getEmployeeData = async (uid: string): Promise<Employee> => {
    const docRef = doc(db, 'employees', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { uid: docSnap.id, ...(docSnap.data() as Record<string, any>) } as Employee;
    }
    throw new Error("لم يتم العثور على بيانات الموظف!");
};

export const getAllEmployees = async (): Promise<Employee[]> => {
    const employeesCol = collection(db, 'employees');
    const q = query(employeesCol, orderBy('name'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Record<string, any>) } as Employee));
};

// تم تعديل الدالة لترجع القائمة الثابتة بدلاً من قاعدة البيانات
export const getServices = async (): Promise<ServiceDefinition[]> => {
    return [PERMISSION_SERVICE_DEF];
};

// تم تعديل الدالة لترجع تعريف الخدمة الثابت
export const getServiceDefinition = async (serviceId: string): Promise<ServiceDefinition> => {
    if (serviceId === 'permission_request') {
        return PERMISSION_SERVICE_DEF;
    }
    throw new Error("الخدمة غير موجودة أو لم يتم تفعيلها بعد.");
};

export const getEmployeeRequests = async (employeeId: string): Promise<Request[]> => {
    const requestsCol = collection(db, 'requests');
    const q = query(requestsCol, where("employeeId", "==", employeeId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request));
};

export const getAssignedRequests = async (managerId: string): Promise<Request[]> => {
    const requestsCol = collection(db, 'requests');
    const q = query(
        requestsCol,
        where("assignedTo", "==", managerId),
        where("status", "==", RequestStatus.PENDING),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request));
};

export const getRequestDetails = async (requestId: string): Promise<Request> => {
    const docRef = doc(db, 'requests', requestId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as Request;
    }
    throw new Error("الطلب غير موجود!");
};

export const getMonthlyPermissionUsage = async (employeeId: string, month: number, year: number): Promise<number> => {
    const requestsCol = collection(db, 'requests');
    const q = query(
        requestsCol, 
        where("employeeId", "==", employeeId),
        where("serviceId", "==", "permission_request"),
        where("status", "in", [RequestStatus.APPROVED, RequestStatus.PENDING]) 
    );
    
    const snapshot = await getDocs(q);
    let totalMinutes = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Check both date formats (string YYYY-MM-DD or Timestamp)
        let reqDate = new Date(data.payload.date);
        
        if (reqDate.getMonth() === month && reqDate.getFullYear() === year) {
            totalMinutes += Number(data.payload.durationMinutes || 0);
        }
    });

    return totalMinutes / 60; 
};

export const getSubordinatesRequests = async (managerId: string): Promise<Request[]> => {
    const employeesCol = collection(db, 'employees');
    const empQuery = query(employeesCol, where("reportsTo", "==", managerId));
    const empSnap = await getDocs(empQuery);
    const subordinateIds = empSnap.docs.map(d => d.id);

    if (subordinateIds.length === 0) return [];

    const requestsCol = collection(db, 'requests');
    const q = query(
        requestsCol,
        where("employeeId", "in", subordinateIds.slice(0, 10)), 
        where("serviceId", "==", "permission_request"),
        orderBy("createdAt", "desc")
    );
    
    const reqSnap = await getDocs(q);
    return reqSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request));
};

// --- محرك سير العمل وعمليات الكتابة (Workflow Engine & Write Operations) ---

export const registerNewEmployee = async (data: any): Promise<void> => {
    const tempApp = initializeApp(firebaseConfig, "secondaryApp");
    const tempAuth = getAuth(tempApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
        const uid = userCredential.user.uid;

        const employeeData: Omit<Employee, 'uid'> = {
            name: data.name,
            email: data.email,
            department: data.department,
            jobTitle: data.jobTitle,
            reportsTo: data.reportsTo || null,
            systemRole: data.systemRole || SystemRole.EMPLOYEE,
            balances: {
                annual: Number(data.balances.annual) || 0,
                sick: Number(data.balances.sick) || 0,
                casual: Number(data.balances.casual) || 0,
                permissionsUsed: 0
            },
            delegation: null
        };

        await setDoc(doc(db, 'employees', uid), employeeData);
        await signOut(tempAuth);
    } catch (error: any) {
        console.error("Error creating user:", error);
        throw error; 
    } finally {
        await deleteApp(tempApp);
    }
};

export const updateEmployeeAdminData = async (uid: string, data: Partial<Employee>): Promise<void> => {
    const employeeRef = doc(db, 'employees', uid);
    await updateDoc(employeeRef, data);
};

export const updateEmployeeDelegation = async (uid: string, delegation: { uid: string, name: string, until: string } | null): Promise<void> => {
    const employeeRef = doc(db, 'employees', uid);
    let dataToUpdate = null;
    if (delegation) {
        dataToUpdate = {
            uid: delegation.uid,
            name: delegation.name,
            until: Timestamp.fromDate(new Date(delegation.until))
        };
    }
    await updateDoc(employeeRef, {
        delegation: dataToUpdate
    });
};

export const updateEmployeeRole = async (uid: string, newRole: SystemRole): Promise<void> => {
    const employeeRef = doc(db, 'employees', uid);
    await updateDoc(employeeRef, {
        systemRole: newRole
    });
};

const getNextAssignee = async (employeeId: string, service: ServiceDefinition, currentStepIndex: number): Promise<string | null> => {
    if (currentStepIndex + 1 >= service.approvalSteps.length) {
        return null; 
    }

    const nextStep = service.approvalSteps[currentStepIndex + 1];
    let assigneeUid: string | null = null;

    if (nextStep.type === ApprovalStepType.REPORTS_TO) {
        const employee = await getEmployeeData(employeeId);
        if (!employee.reportsTo) throw new Error("لا يوجد مدير مباشر معين لهذا الموظف.");
        assigneeUid = employee.reportsTo;
    } else if (nextStep.type === ApprovalStepType.SYSTEM_ROLE) {
        const employeesCol = collection(db, 'employees');
        const q = query(employeesCol, where("systemRole", "==", nextStep.roleValue));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error(`لم يتم العثور على موظف بالدور الوظيفي: ${nextStep.roleValue}`);
        assigneeUid = querySnapshot.docs[0].id;
    }

    if (assigneeUid) {
        const assigneeData = await getEmployeeData(assigneeUid);
        if (assigneeData.delegation && assigneeData.delegation.uid) {
            const now = Timestamp.now();
            if (assigneeData.delegation.until.toMillis() > now.toMillis()) {
                console.log(`Task delegated from ${assigneeData.name} to ${assigneeData.delegation.name}`);
                return assigneeData.delegation.uid;
            }
        }
    }
    
    return assigneeUid;
};

export const createRequest = async (employeeId: string, employeeName: string, service: ServiceDefinition, payload: Record<string, any>, isDraft: boolean = false): Promise<void> => {
    
    let initialAssignee = "";
    let status = RequestStatus.PENDING;
    let actionLog = 'إنشاء الطلب';

    if (isDraft) {
        status = RequestStatus.DRAFT;
        initialAssignee = employeeId; 
        actionLog = 'حفظ كمسودة';
    } else {
        const next = await getNextAssignee(employeeId, service, -1);
        if (!next) throw new Error("تعذر تحديد المسؤول عن الموافقة الأولى.");
        initialAssignee = next;
    }

    const employee = await getEmployeeData(employeeId);

    const requestsCol = collection(db, 'requests');
    await addDoc(requestsCol, {
        employeeId,
        employeeName,
        department: employee.department || '',
        serviceId: service.id,
        serviceTitle: service.title,
        status: status,
        currentStepIndex: 0,
        assignedTo: initialAssignee,
        payload,
        createdAt: serverTimestamp(),
        history: [{
            user: employeeName,
            uid: employeeId,
            action: actionLog,
            time: Timestamp.now(),
        }],
    });
};


export const processRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'SUBMIT', note: string, userUid: string, userName: string) => {
    const requestRef = doc(db, 'requests', requestId);
    
    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) throw new Error("الطلب غير موجود");
    
        const request = requestSnap.data() as Request;
        // Fetch definition from hardcoded constant logic
        const service = await getServiceDefinition(request.serviceId);
        
        const newHistoryEntry = {
            user: userName,
            uid: userUid,
            action: '',
            note: note || '',
            time: Timestamp.now(),
        };
        
        let updateData: Partial<Request> = {};

        if (action === 'SUBMIT') { 
             newHistoryEntry.action = 'تقديم الطلب';
             const nextAssignee = await getNextAssignee(request.employeeId, service, -1); 
             if (!nextAssignee) throw new Error("خطأ في تحديد المسار");
             updateData.status = RequestStatus.PENDING;
             updateData.assignedTo = nextAssignee;
             updateData.currentStepIndex = 0;

        } else if (action === 'REJECT') {
            newHistoryEntry.action = 'رفض الطلب';
            updateData.status = RequestStatus.REJECTED;
            updateData.assignedTo = ''; 
        } else if (action === 'RETURN') {
            newHistoryEntry.action = 'طلب تعديل';
            updateData.status = RequestStatus.RETURNED;
            updateData.assignedTo = request.employeeId; 
        } else if (action === 'APPROVE') {
            newHistoryEntry.action = 'موافقة على الطلب';
            const nextAssignee = await getNextAssignee(request.employeeId, service, request.currentStepIndex);
            
            if (nextAssignee) {
                updateData.assignedTo = nextAssignee;
                updateData.currentStepIndex = request.currentStepIndex + 1;
            } else {
                updateData.status = RequestStatus.APPROVED;
                updateData.assignedTo = '';
            }
        }
        
        const updatedHistory = [...request.history, newHistoryEntry];
        transaction.update(requestRef, { ...updateData, history: updatedHistory });
    });
};