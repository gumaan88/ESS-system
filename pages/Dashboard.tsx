import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getEmployeeRequests } from '../services/firebaseService';
import { Request, RequestStatus } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const getStatusChipClass = (status: RequestStatus) => {
    switch (status) {
        case RequestStatus.APPROVED:
            return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
        case RequestStatus.REJECTED:
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300';
        case RequestStatus.PENDING:
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
        case RequestStatus.RETURNED:
            return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300';
        case RequestStatus.DRAFT:
            return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

const Dashboard: React.FC = () => {
    const { employeeData, user } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            if (user) {
                setLoading(true);
                try {
                    const userRequests = await getEmployeeRequests(user.uid);
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

    if (!employeeData) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    const drafts = requests.filter(r => r.status === RequestStatus.DRAFT);
    const recentRequests = requests.filter(r => r.status !== RequestStatus.DRAFT);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white">أهلاً بك، {employeeData.name}</h1>
                    <p className="mt-1 text-slate-500 dark:text-gray-400">مرحباً بك في بوابة الموظف الذكية - مؤسسة العون للتنمية</p>
                </div>
                <Link to="/new-request" className="px-8 py-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-200 dark:shadow-none hover:bg-teal-700 transition-all hover:-translate-y-1 font-bold">
                    + تقديم طلب جديد
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <h3 className="text-teal-50 font-medium opacity-80">رصيد الإجازات السنوية</h3>
                    <div className="flex items-end gap-2 mt-2">
                        <span className="text-4xl font-black text-white">{employeeData.balances.annual}</span>
                        <span className="text-teal-100 font-bold mb-1">يوم</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:border-teal-200 transition-colors">
                    <h3 className="text-slate-500 dark:text-gray-400 font-medium">رصيد الأذونات الشهرية</h3>
                    <div className="flex items-end gap-2 mt-2">
                        <span className="text-4xl font-black text-teal-600 dark:text-teal-400">{employeeData.balances.permissionsUsed || 0}</span>
                        <span className="text-slate-400 font-bold mb-1">/ 8 ساعة</span>
                    </div>
                    <div className="mt-4 w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-teal-500 h-full transition-all duration-1000" 
                            style={{ width: `${Math.min((employeeData.balances.permissionsUsed / 8) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-slate-500 dark:text-gray-400 font-medium">إجمالي الطلبات</h3>
                    <div className="flex items-end gap-2 mt-2">
                        <span className="text-4xl font-black text-slate-800 dark:text-white">{requests.length}</span>
                        <span className="text-slate-400 font-bold mb-1">طلب</span>
                    </div>
                </div>
            </div>

            {drafts.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-6 rounded-3xl">
                    <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-4 flex items-center gap-2">
                        <span className="text-2xl">📝</span> المسودات المحفوظة
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {drafts.map(draft => (
                             <div key={draft.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/50 flex justify-between items-center group">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{draft.serviceTitle}</h4>
                                    <p className="text-xs text-slate-400 mt-1">{draft.createdAt.toDate().toLocaleDateString('ar-EG')}</p>
                                </div>
                                <Link to={`/request/${draft.id}`} className="p-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-600 hover:text-white transition-all">
                                    متابعة
                                </Link>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white">أحدث التحركات</h2>
                    <Link to="/my-requests" className="text-teal-600 font-bold text-sm hover:underline">عرض الكل ←</Link>
                </div>
                
                {loading ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
                ) : recentRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                                    <th className="px-6 py-4">الخدمة</th>
                                    <th className="px-6 py-4">تاريخ التقديم</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {recentRequests.slice(0, 5).map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700 dark:text-white">{req.serviceTitle}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{req.createdAt.toDate().toLocaleDateString('ar-EG')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-4 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusChipClass(req.status)}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Link to={`/request/${req.id}`} className="text-teal-600 font-bold hover:text-teal-800">
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
                        <div className="text-4xl mb-4">📭</div>
                        <p className="text-slate-400">لا توجد طلبات نشطة حالياً.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;