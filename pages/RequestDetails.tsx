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

const formatDuration = (ms: number) => {
    if (ms < 1000) return "لحظات";
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} يوم ${hours % 24 > 0 ? `و ${hours % 24} ساعة` : ''}`;
    if (hours > 0) return `${hours} ساعة ${minutes % 60 > 0 ? `و ${minutes % 60} دقيقة` : ''}`;
    if (minutes > 0) return `${minutes} دقيقة`;
    return "أقل من دقيقة";
};

const RequestDetails: React.FC = () => {
    const { requestId } = useParams<{ requestId: string }>();
    const navigate = useNavigate();
    const { user, employeeData } = useAuth();
    
    const [request, setRequest] = useState<Request | null>(null);
    const [requestor, setRequestor] = useState<Employee | null>(null);
    const [assigneeName, setAssigneeName] = useState<string>(''); 
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
                    // Fetch Requestor Data
                    try {
                        const reqtorData = await getEmployeeData(reqDetails.employeeId);
                        setRequestor(reqtorData);
                    } catch (e) {
                        console.warn("Could not fetch requestor data", e);
                    }

                    // Fetch Assignee Name if needed
                    if (reqDetails.status === RequestStatus.PENDING && reqDetails.assignedTo) {
                        try {
                            const assignee = await getEmployeeData(reqDetails.assignedTo);
                            setAssigneeName(assignee.name);
                        } catch (e) {
                            setAssigneeName('غير معروف');
                        }
                    }
                }
            } catch (err: any) {
                console.error(err);
                if (err.code === 'permission-denied') {
                    setError("ليس لديك صلاحية لعرض هذا الطلب (Permission Denied).");
                } else {
                    setError("لا يمكن تحميل تفاصيل الطلب.");
                }
            }
            setLoading(false);
        };
        fetchDetails();
    }, [requestId]);
    
    // Check permissions
    const isOwner = user && request && request.employeeId === user.uid;
    // Strict check: User must be logged in, Request must be loaded, User UID must match AssignedTo, Status must be PENDING
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
            // Navigate back to inbox if manager, or my requests if owner
            if (canTakeAction) {
                navigate('/inbox');
            } else {
                navigate('/my-requests');
            }
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
    
    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-red-500 text-5xl mb-4">🚫</div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">خطأ في الوصول</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-teal-600 hover:underline">العودة</button>
        </div>
    );

    if (!request) return <p className="text-center text-red-500">لم يتم العثور على الطلب.</p>;

    const getStatusChipClass = (status: RequestStatus) => {
        switch (status) {
            case RequestStatus.APPROVED: return 'bg-green-100 text-green-800 border-green-200';
            case RequestStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
            case RequestStatus.PENDING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case RequestStatus.RETURNED: return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
            case RequestStatus.DRAFT: return 'bg-gray-200 text-gray-800 border-gray-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    // Find the latest return note if status is RETURNED
    const lastReturnEntry = request.status === RequestStatus.RETURNED 
        ? [...request.history].reverse().find(h => h.action.includes('تعديل') || h.note) 
        : null;

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
            <Notification message={error} type="error" onClose={() => setError('')} />

            {/* --- ALERT FOR RETURNED REQUEST --- */}
            {isDraftOrReturned && request.status === RequestStatus.RETURNED && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded shadow-md flex justify-between items-center animate-in slide-in-from-top-4">
                    <div>
                        <div className="flex items-center">
                            <span className="text-2xl mr-2">↩️</span>
                            <h3 className="font-bold text-blue-800">هذا الطلب معاد إليك للتعديل</h3>
                        </div>
                        {lastReturnEntry && (
                            <div className="mt-2 text-sm text-blue-700">
                                <span className="font-bold">ملاحظة من {lastReturnEntry.user}:</span> "{lastReturnEntry.note}"
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleEditDraft}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition-transform hover:scale-105"
                    >
                        تعديل الآن
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                {/* Header */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">📝</span>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{request.serviceTitle}</h1>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            مقدم الطلب: <span className="font-semibold text-gray-800 dark:text-gray-200">{requestor?.name || request.employeeName}</span>
                            {requestor?.department && ` - ${requestor.department}`}
                        </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`px-4 py-1.5 text-sm font-bold rounded-full border ${getStatusChipClass(request.status)}`}>
                            {request.status === RequestStatus.DRAFT ? 'مسودة' :
                             request.status === RequestStatus.PENDING ? 'قيد الانتظار' :
                             request.status === RequestStatus.APPROVED ? 'مقبول' :
                             request.status === RequestStatus.REJECTED ? 'مرفوض' :
                             request.status === RequestStatus.RETURNED ? 'معاد للتعديل' : request.status}
                        </span>
                        {request.status === RequestStatus.PENDING && assigneeName && (
                            <p className="text-xs text-gray-500 mt-2">
                                المسؤول الحالي: <span className="font-bold text-gray-700 dark:text-gray-300">{assigneeName}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Request Payload */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                            تفاصيل الطلب
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 space-y-4">
                            {/* Special display for Time Range */}
                            {request.payload.startTime && request.payload.endTime && (
                                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
                                     <dt className="text-sm text-gray-500 dark:text-gray-400">الوقت</dt>
                                     <dd className="text-sm font-bold text-teal-600 dark:text-teal-400 dir-ltr">
                                         {request.payload.startTime} - {request.payload.endTime}
                                     </dd>
                                </div>
                            )}

                            {Object.entries(request.payload).map(([key, value]) => {
                                // Skip start/end time as we displayed them above
                                if (key === 'startTime' || key === 'endTime') return null;
                                
                                return (
                                    <div key={key} className="flex flex-col sm:flex-row justify-between border-b border-gray-200 dark:border-gray-800 last:border-0 pb-3 last:pb-0">
                                        <dt className="text-sm text-gray-500 dark:text-gray-400">
                                            {FIELD_LABELS[key] || key}
                                        </dt>
                                        <dd className="mt-1 sm:mt-0 text-sm font-bold text-gray-900 dark:text-white text-left break-words max-w-full sm:max-w-[70%]">
                                            {typeof value === 'string' && (value.startsWith('http') || value.startsWith('https')) ? 
                                                <a href={value} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1">
                                                    <span>📎</span> عرض المرفق
                                                </a> : 
                                                value}
                                        </dd>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* History Timeline */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                            سجل الإجراءات
                        </h3>
                        <div className="relative border-r border-gray-200 dark:border-gray-700 pr-4 mr-2">
                           {request.history.map((entry, index) => {
                               // Calculate duration spent in this stage (until next step)
                               let durationStr = "";
                               if (index < request.history.length - 1) {
                                   const nextEntry = request.history[index + 1];
                                   if (entry.time && nextEntry.time) {
                                       const diff = nextEntry.time.toMillis() - entry.time.toMillis();
                                       durationStr = formatDuration(diff);
                                   }
                               }

                               return (
                                   <div key={index} className="mb-8 relative">
                                       <div className={`absolute w-3 h-3 rounded-full mt-1.5 -right-[21px] border-2 border-white dark:border-gray-800 ${
                                            entry.action.includes('رفض') ? 'bg-red-500' : 
                                            entry.action.includes('تعديل') ? 'bg-blue-500' : 'bg-teal-500'
                                       }`}></div>
                                       
                                       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                                           <h4 className="text-sm font-bold text-gray-900 dark:text-white">{entry.action}</h4>
                                           <time className="text-xs text-gray-400">{entry.time?.toDate ? entry.time.toDate().toLocaleString('ar-EG') : 'Invalid Date'}</time>
                                       </div>
                                       
                                       <p className="text-xs text-gray-500">بواسطة: {entry.user}</p>
                                       
                                       {durationStr && (
                                           <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                                               <span>⏳</span>
                                               <span>استغرق في هذه المرحلة: {durationStr}</span>
                                           </div>
                                       )}

                                       {entry.note && (
                                           <div className={`mt-2 text-sm p-3 rounded-lg border ${
                                                entry.action.includes('تعديل') 
                                                ? 'bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200' 
                                                : 'bg-gray-50 border-gray-100 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                                           }`}>
                                               <span className="font-bold block mb-1">ملاحظة:</span>
                                               "{entry.note}"
                                           </div>
                                       )}
                                       
                                       {/* Quick Action Button for Returned Requests in History */}
                                       {entry.action.includes('تعديل') && isOwner && request.status === RequestStatus.RETURNED && index === request.history.length - 1 && (
                                            <div className="mt-3">
                                                <button 
                                                    onClick={handleEditDraft}
                                                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-sm transition-transform hover:scale-105"
                                                >
                                                    <span>✏️</span> تعديل الطلب الآن
                                                </button>
                                            </div>
                                       )}
                                   </div>
                               );
                           })}
                        </div>
                    </div>
                </div>
                
                {/* --- MANAGER ACTIONS AREA --- */}
                {canTakeAction && !action && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">اتخاذ قرار</h3>
                        <div className="flex flex-wrap gap-4 justify-end">
                            <button 
                                onClick={() => setAction('RETURN')} 
                                className="flex-1 sm:flex-none px-6 py-3 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 font-bold shadow-sm transition-all"
                            >
                                ↩️ طلب تعديل
                            </button>
                            <button 
                                onClick={() => setAction('REJECT')} 
                                className="flex-1 sm:flex-none px-6 py-3 bg-white border border-red-200 text-red-700 rounded-xl hover:bg-red-50 font-bold shadow-sm transition-all"
                            >
                                ❌ رفض الطلب
                            </button>
                            <button 
                                onClick={() => setAction('APPROVE')} 
                                className="flex-1 sm:flex-none px-8 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold shadow-lg shadow-teal-200 dark:shadow-none transition-all transform hover:-translate-y-1"
                            >
                                ✅ موافقة
                            </button>
                        </div>
                    </div>
                )}
                
                {/* --- CONFIRMATION / NOTE AREA --- */}
                {canTakeAction && action && (
                     <div className="bg-gray-50 dark:bg-gray-900 p-6 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-2">
                         <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">
                             {action === 'APPROVE' ? 'تأكيد الموافقة' : action === 'REJECT' ? 'سبب الرفض' : 'ملاحظات التعديل'}
                         </h3>
                         <p className="text-sm text-gray-500 mb-3">
                             {action === 'APPROVE' ? 'يمكنك إضافة ملاحظة اختيارية.' : 'يرجى ذكر السبب للموظف.'}
                         </p>
                         <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-base dark:bg-gray-800 dark:border-gray-600 dark:text-white p-3"
                            placeholder="اكتب هنا..."
                        />
                        <div className="mt-4 flex justify-end gap-3">
                            <button 
                                onClick={() => { setAction(null); setError(''); }} 
                                disabled={processing} 
                                className="px-6 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleActionSubmit} 
                                disabled={processing} 
                                className={`px-8 py-2 text-white rounded-lg font-bold shadow-md transition-all ${
                                    action === 'APPROVE' ? 'bg-teal-600 hover:bg-teal-700' : 
                                    action === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {processing ? 'جاري المعالجة...' : 'تأكيد وإرسال'}
                            </button>
                        </div>
                     </div>
                )}

                {/* --- DRAFT EDIT ACTIONS (Bottom bar as well) --- */}
                {isDraftOrReturned && (
                     <div className="bg-amber-50 dark:bg-amber-900/20 p-6 border-t border-amber-200 dark:border-amber-800 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-amber-800 dark:text-amber-200">الطلب بحاجة لمراجعتك</h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300">يمكنك تعديل البيانات وإعادة الإرسال.</p>
                        </div>
                        <button 
                            onClick={handleEditDraft}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl shadow-lg hover:bg-amber-600 transition-all font-bold"
                        >
                            <span>✏️</span> تعديل الطلب
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestDetails;