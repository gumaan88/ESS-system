import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestDetails, getEmployeeData, processRequestAction } from '../services/firebaseService';
import { Request, HistoryEntry, RequestStatus, Employee } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import Notification from '../components/Notification';

const FIELD_LABELS: Record<string, string> = {
    'permissionType': 'نوع الإذن',
    'reason': 'السبب',
    'date': 'التاريخ',
    'startTime': 'وقت البداية',
    'endTime': 'وقت النهاية',
    'durationMinutes': 'المدة (دقائق)',
    'durationHours': 'المدة (ساعات)',
    'type': 'التصنيف'
};

const RequestDetails: React.FC = () => {
    const { requestId } = useParams<{ requestId: string }>();
    const navigate = useNavigate();
    const { user, employeeData } = useAuth();
    
    const [request, setRequest] = useState<Request | null>(null);
    const [requestor, setRequestor] = useState<Employee | null>(null);
    const [assigneeName, setAssigneeName] = useState<string>(''); // For tracking who has the request
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!requestId) return;
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const reqDetails = await getRequestDetails(requestId);
                setRequest(reqDetails);
                
                if (reqDetails) {
                    const reqtorData = await getEmployeeData(reqDetails.employeeId);
                    setRequestor(reqtorData);

                    // Fetch current assignee name if pending
                    if (reqDetails.status === RequestStatus.PENDING && reqDetails.assignedTo) {
                        try {
                            const assignee = await getEmployeeData(reqDetails.assignedTo);
                            setAssigneeName(assignee.name);
                        } catch (e) {
                            setAssigneeName('غير معروف');
                        }
                    }
                }
            } catch (err) {
                setError("لا يمكن تحميل تفاصيل الطلب.");
            }
            setLoading(false);
        };
        fetchDetails();
    }, [requestId]);
    
    // Check permissions
    const isOwner = user && request && request.employeeId === user.uid;
    const canTakeAction = user && request && request.assignedTo === user.uid && request.status === RequestStatus.PENDING;
    const isDraftOrReturned = isOwner && (request?.status === RequestStatus.DRAFT || request?.status === RequestStatus.RETURNED);

    const handleActionSubmit = async () => {
        if (!action || !requestId || !user || !employeeData) return;
        if ((action === 'REJECT' || action === 'RETURN') && !note.trim()) {
            setError("الملاحظة إجبارية عند الرفض أو طلب التعديل.");
            return;
        }

        setProcessing(true);
        setError('');
        try {
            await processRequestAction(requestId, action, note, user.uid, employeeData.name);
            setAction(null);
            setNote('');
            navigate('/inbox');
        } catch (err) {
            setError("حدث خطأ أثناء معالجة الإجراء.");
            console.error(err);
        }
        setProcessing(false);
    };
    
    const handleEditDraft = () => {
        if (!request) return;
        navigate(`/request-form/${request.serviceId}?draftId=${request.id}`);
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    if (!request || !requestor) return <p className="text-center text-red-500">{error || "لم يتم العثور على الطلب."}</p>;

    const getStatusChipClass = (status: RequestStatus) => {
        switch (status) {
            case RequestStatus.APPROVED: return 'bg-green-100 text-green-800';
            case RequestStatus.REJECTED: return 'bg-red-100 text-red-800';
            case RequestStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
            case RequestStatus.RETURNED: return 'bg-blue-100 text-blue-800';
            case RequestStatus.DRAFT: return 'bg-gray-200 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <Notification message={error} type="error" onClose={() => setError('')} />

            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{request.serviceTitle}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">مقدم من: {requestor.name} - {requestor.department}</p>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                        <span className={`px-4 py-1 text-sm font-semibold rounded-full block text-center mb-2 ${getStatusChipClass(request.status)}`}>
                            {request.status === RequestStatus.DRAFT ? 'مسودة' :
                             request.status === RequestStatus.PENDING ? 'قيد الانتظار' :
                             request.status === RequestStatus.APPROVED ? 'مقبول' :
                             request.status === RequestStatus.REJECTED ? 'مرفوض' :
                             request.status === RequestStatus.RETURNED ? 'معاد للتعديل' : request.status}
                        </span>
                        {request.status === RequestStatus.PENDING && assigneeName && (
                            <p className="text-xs text-gray-500">بانتظار موافقة: <span className="font-bold text-gray-700 dark:text-gray-300">{assigneeName}</span></p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Request Payload */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 flex items-center">
                            <span className="ml-2">📄</span> تفاصيل الطلب
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
                            {Object.entries(request.payload).map(([key, value]) => (
                                <div key={key} className="flex flex-col sm:flex-row justify-between border-b border-gray-200 dark:border-gray-800 last:border-0 pb-2 last:pb-0">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {FIELD_LABELS[key] || key}
                                    </dt>
                                    <dd className="mt-1 sm:mt-0 text-sm font-bold text-gray-900 dark:text-white text-left">
                                        {typeof value === 'string' && (value.startsWith('http') || value.startsWith('https')) ? 
                                            <a href={value} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1">
                                                <span>📎</span> عرض المرفق
                                            </a> : 
                                            value}
                                    </dd>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* History Timeline */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 flex items-center">
                            <span className="ml-2">🕒</span> سجل الإجراءات
                        </h3>
                        <ol className="relative border-s border-gray-200 dark:border-gray-700 mr-2">
                           {request.history.map((entry, index) => (
                               <li key={index} className="mb-6 ms-4">
                                   <div className="absolute w-3 h-3 bg-teal-200 rounded-full mt-1.5 -start-1.5 border border-white dark:border-gray-900 dark:bg-teal-700"></div>
                                   <time className="mb-1 text-xs font-normal leading-none text-gray-400 dark:text-gray-500">{entry.time.toDate().toLocaleString('ar-EG')}</time>
                                   <h3 className="text-sm font-bold text-gray-900 dark:text-white">{entry.action} <span className="font-normal text-gray-500">بواسطة</span> {entry.user}</h3>
                                   {entry.note && <p className="text-sm font-normal text-gray-600 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 p-2 rounded-md mt-2">{entry.note}</p>}
                               </li>
                           ))}
                        </ol>
                    </div>
                </div>
                
                {/* --- Draft/Returned Actions (For Requester) --- */}
                {isDraftOrReturned && (
                     <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end">
                        <button 
                            onClick={handleEditDraft}
                            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl shadow-lg shadow-teal-200 dark:shadow-none hover:bg-teal-700 transition-all font-bold animate-pulse"
                        >
                            <span>✏️</span>
                            {request.status === RequestStatus.DRAFT ? 'استكمال المسودة' : 'تعديل وإعادة الإرسال'}
                        </button>
                    </div>
                )}

                {/* --- Approval Actions (For Manager) --- */}
                {canTakeAction && !action && (
                    <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end space-x-3 space-x-reverse">
                        <button onClick={() => setAction('RETURN')} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors">طلب تعديل</button>
                        <button onClick={() => setAction('REJECT')} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors">رفض</button>
                        <button onClick={() => setAction('APPROVE')} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-md">موافقة</button>
                    </div>
                )}
                
                {canTakeAction && action && (
                     <div className="mt-8 pt-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                         <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">إضافة ملاحظة ({action === 'APPROVE' ? 'اختياري' : 'إجباري'})</h3>
                         <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            placeholder="اكتب ملاحظتك هنا..."
                        />
                        <div className="mt-4 flex justify-end space-x-3 space-x-reverse">
                            <button onClick={() => setAction(null)} disabled={processing} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition-colors">إلغاء</button>
                            <button onClick={handleActionSubmit} disabled={processing} className="px-6 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-teal-400 font-bold shadow-md transition-all">
                                {processing ? 'جاري التنفيذ...' : 'تأكيد الإجراء'}
                            </button>
                        </div>
                     </div>
                )}
            </div>
        </div>
    );
};

export default RequestDetails;