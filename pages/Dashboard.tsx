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
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">أهلاً بك، {employeeData.name}</h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">هذه هي لوحة التحكم الخاصة بك.</p>
                </div>
                <Link to="/new-request" className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors">
                    طلب جديد
                </Link>
            </div>

            {/* Balances Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">رصيد الإجازات</h3>
                    <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{employeeData.balances.annual} يوم</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">رصيد الأذونات</h3>
                    <p className="text-4xl font-bold text-teal-600 dark:text-teal-400 mt-2">{employeeData.balances.permissionsUsed || 0} / 8 ساعة</p>
                </div>
            </div>

             {/* Drafts Section */}
             {drafts.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <span>📝</span> المسودات
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {drafts.map(draft => (
                             <div key={draft.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-100 dark:border-gray-600 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">{draft.serviceTitle}</h4>
                                    <p className="text-xs text-gray-500">{draft.createdAt.toDate().toLocaleDateString('ar-EG')}</p>
                                </div>
                                <Link to={`/request/${draft.id}`} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100">
                                    متابعة
                                </Link>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Requests Section */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">أحدث الطلبات</h2>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    {loading ? (
                        <div className="flex justify-center"><Spinner /></div>
                    ) : recentRequests.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الخدمة</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">تاريخ الإنشاء</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الحالة</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {recentRequests.slice(0, 5).map(req => (
                                        <tr key={req.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{req.serviceTitle}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{req.createdAt.toDate().toLocaleDateString('ar-EG')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChipClass(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                                <Link to={`/request/${req.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">
                                                    عرض
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">لا توجد طلبات لعرضها.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;