import { db } from './firebaseConfig';
import { 
    doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, 
    serverTimestamp, Timestamp, runTransaction 
} from 'firebase/firestore';
import { Employee, ServiceDefinition, Request, RequestStatus, ApprovalStepType } from '../types';

// --- عمليات القراءة (Read Operations) ---

export const getEmployeeData = async (uid: string): Promise<Employee> => {
    const docRef = doc(db, 'employees', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { uid: docSnap.id, ...(docSnap.data() as Record<string, any>) } as Employee;
    }
    throw new Error("لم يتم العثور على بيانات الموظف!");
};

export const getServices = async (): Promise<ServiceDefinition[]> => {
    const servicesCol = collection(db, 'services');
    const servicesSnapshot = await getDocs(servicesCol);
    return servicesSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, any>) } as ServiceDefinition));
};

export const getServiceDefinition = async (serviceId: string): Promise<ServiceDefinition> => {
    const docRef = doc(db, 'services', serviceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as ServiceDefinition;
    }
    throw new Error("لم يتم العثور على تعريف الخدمة!");
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

// --- محرك سير العمل وعمليات الكتابة (Workflow Engine & Write Operations) ---

const getNextAssignee = async (employeeId: string, service: ServiceDefinition, currentStepIndex: number): Promise<string | null> => {
    if (currentStepIndex + 1 >= service.approvalSteps.length) {
        return null; // تمت جميع الموافقات
    }

    const nextStep = service.approvalSteps[currentStepIndex + 1];
    if (nextStep.type === ApprovalStepType.REPORTS_TO) {
        const employee = await getEmployeeData(employeeId);
        if (!employee.reportsTo) throw new Error("لا يوجد مدير مباشر معين لهذا الموظف.");
        return employee.reportsTo;
    }

    if (nextStep.type === ApprovalStepType.SYSTEM_ROLE) {
        const employeesCol = collection(db, 'employees');
        const q = query(employeesCol, where("systemRole", "==", nextStep.roleValue));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error(`لم يتم العثور على موظف بالدور الوظيفي: ${nextStep.roleValue}`);
        return querySnapshot.docs[0].id;
    }
    
    return null;
};

export const createRequest = async (employeeId: string, employeeName: string, service: ServiceDefinition, payload: Record<string, any>): Promise<void> => {
    const initialAssignee = await getNextAssignee(employeeId, service, -1);
    if (!initialAssignee) throw new Error("تعذر تحديد المسؤول عن الموافقة الأولى.");

    const requestsCol = collection(db, 'requests');
    await addDoc(requestsCol, {
        employeeId,
        employeeName,
        serviceId: service.id,
        serviceTitle: service.title,
        status: RequestStatus.PENDING,
        currentStepIndex: 0,
        assignedTo: initialAssignee,
        payload,
        createdAt: serverTimestamp(),
        history: [{
            user: employeeName,
            uid: employeeId,
            action: 'إنشاء الطلب',
            time: Timestamp.now(),
        }],
    });
};


export const processRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', note: string, userUid: string, userName: string) => {
    const requestRef = doc(db, 'requests', requestId);
    
    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) throw new Error("الطلب غير موجود");
    
        const request = requestSnap.data() as Request;
        const service = await getServiceDefinition(request.serviceId);
        
        const newHistoryEntry = {
            user: userName,
            uid: userUid,
            action: '',
            note: note || '',
            time: Timestamp.now(),
        };
        
        let updateData: Partial<Request> = {};

        if (action === 'REJECT') {
            newHistoryEntry.action = 'رفض الطلب';
            updateData.status = RequestStatus.REJECTED;
            updateData.assignedTo = ''; // لا يوجد مسؤول بعد الرفض
        } else if (action === 'RETURN') {
            newHistoryEntry.action = 'طلب تعديل';
            updateData.status = RequestStatus.RETURNED;
            updateData.assignedTo = request.employeeId; // إعادة للموظف للتعديل
        } else if (action === 'APPROVE') {
            newHistoryEntry.action = 'موافقة على الطلب';
            const nextAssignee = await getNextAssignee(request.employeeId, service, request.currentStepIndex);
            
            if (nextAssignee) {
                updateData.assignedTo = nextAssignee;
                updateData.currentStepIndex = request.currentStepIndex + 1;
            } else {
                // الموافقة النهائية
                updateData.status = RequestStatus.APPROVED;
                updateData.assignedTo = '';
            }
        }
        
        const updatedHistory = [...request.history, newHistoryEntry];
        transaction.update(requestRef, { ...updateData, history: updatedHistory });
    });
};