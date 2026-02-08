import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getEmployeeRequests } from '../services/firebaseService';
import { Request, RequestStatus } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const getStatusChipClass = (status: RequestStatus) => {
    switch (status) {
        case RequestStatus.APPROVED:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case RequestStatus.REJECTED:
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case RequestStatus.PENDING:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case RequestStatus.RETURNED:
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case RequestStatus.DRAFT:
            return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

const MyRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        const fetchRequests = async () => {
            if (user) {
                setLoading(true);
                try {
                    const userRequests = await getEmployeeRequests(user.uid);
                    // Safe Client-side sorting (Newest first)
                    userRequests.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return timeB - timeA;
                    });
                    setRequests(userRequests);
                } catch (error) {
                    console.error("Error fetching requests:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchRequests();
    }, [user]);

    const filteredRequests = requests.filter(req => {
        if (filterStatus === 'ALL') return true;
        return req.status === filterStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">طلباتي</h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">تابع حالة طلباتك الحالية والسابقة.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-300">تصفية حسب الحالة:</label>
                    <select 
                        className="rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="ALL">الكل</option>
                        <option value={RequestStatus.PENDING}>قيد الانتظار</option>
                        <option value={RequestStatus.APPROVED}>مقبول</option>
                        <option value={RequestStatus.REJECTED}>مرفوض</option>
                        <option value={RequestStatus.RETURNED}>مطلوب تعديل</option>
                        <option value={RequestStatus.DRAFT}>مسودة</option>
                    </select>
                    <Link to="/new-request" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                        + طلب جديد
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : filteredRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">نوع الطلب</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">التاريخ</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الحالة</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">بانتظار موافقة</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">{req.serviceTitle}</div>
                                            {req.serviceId === 'permission_request' && req.payload.date && (
                                                <div className="text-xs text-gray-500">
                                                    {req.payload.date} | {req.payload.startTime} - {req.payload.endTime}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('ar-EG') : 'غير متوفر'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChipClass(req.status)}`}>
                                                {req.status === RequestStatus.PENDING ? 'قيد الانتظار' : 
                                                 req.status === RequestStatus.APPROVED ? 'تمت الموافقة' :
                                                 req.status === RequestStatus.REJECTED ? 'مرفوض' :
                                                 req.status === RequestStatus.DRAFT ? 'مسودة' : req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {req.status === RequestStatus.PENDING ? 'المدير المباشر' : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                            <Link to={`/request/${req.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 font-bold">
                                                عرض التفاصيل
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400 text-lg">لا توجد طلبات لعرضها.</p>
                        <Link to="/new-request" className="mt-4 inline-block text-indigo-600 hover:underline">
                            ابدأ بتقديم طلب جديد
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyRequests;