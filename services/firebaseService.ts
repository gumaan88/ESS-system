import { db, firebaseConfig } from './firebaseConfig';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
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
    const docSnap = await db.collection('employees').doc(uid).get();
    if (docSnap.exists) {
        return { uid: docSnap.id, ...(docSnap.data() as Record<string, any>) } as Employee;
    }
    throw new Error("لم يتم العثور على بيانات الموظف!");
};

export const getAllEmployees = async (): Promise<Employee[]> => {
    const querySnapshot = await db.collection('employees').get();
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Record<string, any>) } as Employee));
};

export const getServices = async (): Promise<ServiceDefinition[]> => {
    const services: ServiceDefinition[] = [PERMISSION_SERVICE_DEF];
    try {
        const querySnapshot = await db.collection('services').get();
        querySnapshot.forEach((doc) => {
             services.push({ id: doc.id, ...(doc.data() as any) } as ServiceDefinition);
        });
    } catch (error) {
        console.warn("Could not fetch dynamic services:", error);
    }
    return services;
};

export const getServiceDefinition = async (serviceId: string): Promise<ServiceDefinition> => {
    if (serviceId === 'permission_request') {
        return PERMISSION_SERVICE_DEF;
    }
    try {
        const docSnap = await db.collection('services').doc(serviceId).get();
        if (docSnap.exists) {
            return { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as ServiceDefinition;
        }
    } catch (error) {
        console.warn("Error fetching service definition:", error);
    }
    throw new Error("الخدمة غير موجودة أو لم يتم تفعيلها بعد.");
};

export const getEmployeeRequests = async (employeeId: string): Promise<Request[]> => {
    try {
        const querySnapshot = await db.collection('requests').where("employeeId", "==", employeeId).get();
        const reqs = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request));
        console.log(`Fetched ${reqs.length} requests for employee ${employeeId}`);
        return reqs;
    } catch (e) {
        console.error("Error in getEmployeeRequests:", e);
        throw e;
    }
};

export const getAssignedRequests = async (managerId: string): Promise<Request[]> => {
    try {
        // Fetch all requests assigned to the current user
        const querySnapshot = await db.collection('requests').where("assignedTo", "==", managerId).get();
        const allAssigned = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request));
        
        // Filter for tasks that require action: PENDING (approvals) or RETURNED (corrections)
        const tasks = allAssigned.filter(r => 
            r.status === RequestStatus.PENDING || 
            r.status === RequestStatus.RETURNED
        );
        
        console.log(`Fetched ${allAssigned.length} assigned, ${tasks.length} require action for ${managerId}`);
        return tasks;
    } catch (e) {
        console.error("Error in getAssignedRequests:", e);
        throw e;
    }
};

export const getRequestDetails = async (requestId: string): Promise<Request> => {
    const docSnap = await db.collection('requests').doc(requestId).get();
    if (docSnap.exists) {
        return { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as Request;
    }
    throw new Error("الطلب غير موجود!");
};

export const getMonthlyPermissionUsage = async (employeeId: string, month: number, year: number): Promise<number> => {
    const snapshot = await db.collection('requests').where("employeeId", "==", employeeId).get();
    let totalMinutes = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data() as Request;
        // Client-side filtering
        if (data.serviceId === 'permission_request' && 
           (data.status === RequestStatus.APPROVED || data.status === RequestStatus.PENDING)) {
             
             if (data.payload && data.payload.date) {
                let reqDate = new Date(data.payload.date);
                if (reqDate.getMonth() === month && reqDate.getFullYear() === year) {
                    totalMinutes += Number(data.payload.durationMinutes || 0);
                }
             }
        }
    });

    return totalMinutes / 60; 
};

export const getSubordinatesRequests = async (managerId: string): Promise<Request[]> => {
    const empSnap = await db.collection('employees').where("reportsTo", "==", managerId).get();
    const subordinateIds = empSnap.docs.map(d => d.id);

    if (subordinateIds.length === 0) return [];

    // Using 'in' operator. Max 10 items.
    const chunks = [];
    for (let i = 0; i < subordinateIds.length; i += 10) {
        chunks.push(subordinateIds.slice(i, i + 10));
    }

    let allRequests: Request[] = [];
    
    for (const chunk of chunks) {
        const reqSnap = await db.collection('requests').where("employeeId", "in", chunk).get();
        reqSnap.forEach(doc => {
            allRequests.push({ id: doc.id, ...(doc.data() as Record<string, any>) } as Request);
        });
    }

    return allRequests;
};

// --- محرك سير العمل وعمليات الكتابة (Workflow Engine & Write Operations) ---

export const registerNewEmployee = async (data: any): Promise<void> => {
    const tempApp = firebase.initializeApp(firebaseConfig, "secondaryApp");
    const tempAuth = tempApp.auth();

    try {
        const userCredential = await tempAuth.createUserWithEmailAndPassword(data.email, data.password);
        const uid = userCredential.user?.uid;

        if (!uid) throw new Error("Failed to generate UID");

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

        await db.collection('employees').doc(uid).set(employeeData);
        await tempAuth.signOut();
    } catch (error: any) {
        console.error("Error creating user:", error);
        throw error; 
    } finally {
        await tempApp.delete();
    }
};

export const updateEmployeeAdminData = async (uid: string, data: Partial<Employee>): Promise<void> => {
    await db.collection('employees').doc(uid).update(data);
};

export const updateEmployeeDelegation = async (uid: string, delegation: { uid: string, name: string, until: string } | null): Promise<void> => {
    let dataToUpdate = null;
    if (delegation) {
        dataToUpdate = {
            uid: delegation.uid,
            name: delegation.name,
            until: firebase.firestore.Timestamp.fromDate(new Date(delegation.until))
        };
    }
    await db.collection('employees').doc(uid).update({
        delegation: dataToUpdate
    });
};

export const updateEmployeeRole = async (uid: string, newRole: SystemRole): Promise<void> => {
    await db.collection('employees').doc(uid).update({
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
        if (!employee.reportsTo) {
            throw new Error("عذراً، لا يمكن تقديم الطلب لأنه لم يتم تعيين مدير مباشر لك في النظام. يرجى مراجعة إدارة الموارد البشرية.");
        }
        assigneeUid = employee.reportsTo;
    } else if (nextStep.type === ApprovalStepType.SYSTEM_ROLE) {
        const querySnapshot = await db.collection('employees').where("systemRole", "==", nextStep.roleValue).get();
        if (querySnapshot.empty) throw new Error(`لم يتم العثور على موظف بالدور الوظيفي المطلوب للموافقة: ${nextStep.roleValue}`);
        assigneeUid = querySnapshot.docs[0].id;
    }

    if (assigneeUid) {
        const assigneeData = await getEmployeeData(assigneeUid);
        if (assigneeData.delegation && assigneeData.delegation.uid) {
            const now = firebase.firestore.Timestamp.now();
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
        if (!next) {
            throw new Error("تعذر تحديد المسؤول عن الموافقة الأولى.");
        }
        initialAssignee = next;
    }

    const employee = await getEmployeeData(employeeId);

    await db.collection('requests').add({
        employeeId,
        employeeName,
        department: employee.department || '',
        serviceId: service.id,
        serviceTitle: service.title,
        status: status,
        currentStepIndex: 0,
        assignedTo: initialAssignee,
        payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        history: [{
            user: employeeName,
            uid: employeeId,
            action: actionLog,
            time: firebase.firestore.Timestamp.now(),
        }],
    });
};

export const updateRequest = async (requestId: string, employeeId: string, service: ServiceDefinition, payload: Record<string, any>, isDraft: boolean = false): Promise<void> => {
    const requestRef = db.collection('requests').doc(requestId);
    const requestSnap = await requestRef.get();
    
    if (!requestSnap.exists) throw new Error("الطلب غير موجود");
    const existingRequest = requestSnap.data() as Request;
    
    // Check ownership
    if (existingRequest.employeeId !== employeeId) throw new Error("غير مصرح لك بتعديل هذا الطلب");

    let initialAssignee = existingRequest.assignedTo;
    let status = isDraft ? RequestStatus.DRAFT : RequestStatus.PENDING;
    let actionLog = isDraft ? 'تحديث المسودة' : 'تقديم الطلب (بعد التعديل)';

    if (!isDraft) {
        const next = await getNextAssignee(employeeId, service, -1);
        if (!next) {
            throw new Error("تعذر تحديد المسؤول عن الموافقة الأولى.");
        }
        initialAssignee = next;
    }

    const newHistoryEntry = {
        user: existingRequest.employeeName,
        uid: employeeId,
        action: actionLog,
        time: firebase.firestore.Timestamp.now(),
    };

    await requestRef.update({
        payload,
        status,
        assignedTo: initialAssignee,
        currentStepIndex: 0, // Reset steps when resubmitting
        history: [...existingRequest.history, newHistoryEntry]
    });
};


export const processRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'SUBMIT', note: string, userUid: string, userName: string) => {
    const requestRef = db.collection('requests').doc(requestId);
    
    await db.runTransaction(async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists) throw new Error("الطلب غير موجود");
    
        const request = requestSnap.data() as Request;
        const service = await getServiceDefinition(request.serviceId);
        
        const newHistoryEntry = {
            user: userName,
            uid: userUid,
            action: '',
            note: note || '',
            time: firebase.firestore.Timestamp.now(),
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

export const addService = async (serviceData: Omit<ServiceDefinition, 'id'>): Promise<void> => {
    await db.collection('services').add(serviceData);
};