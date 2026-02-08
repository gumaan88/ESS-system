import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAssignedRequests, getSubordinatesRequests } from '../services/firebaseService';
import { Request, RequestStatus, SystemRole } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const getStatusChipClass = (status: RequestStatus) => {
    switch (status) {
        case RequestStatus.PENDING:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case RequestStatus.APPROVED:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case RequestStatus.REJECTED:
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case RequestStatus.RETURNED:
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

const ManagerInbox: React.FC = () => {
    const { user, employeeData } = useAuth();
    const [activeTab, setActiveTab] = useState<'INBOX' | 'DASHBOARD'>('INBOX');
    const [requests, setRequests] = useState<Request[]>([]);
    const [dashboardData, setDashboardData] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    // Dashboard Filters
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

    const isHOD = employeeData && (employeeData.systemRole === SystemRole.HOD || employeeData.systemRole === SystemRole.HR_SPECIALIST || employeeData.systemRole === SystemRole.HR_MANAGER);

    useEffect(() => {
        const fetchData = async () => {
            if (user) {
                setLoading(true);
                try {
                    // Fetch Inbox
                    const assignedRequests = await getAssignedRequests(user.uid);
                    setRequests(assignedRequests);

                    // Fetch Dashboard Data if HOD
                    if (isHOD) {
                        const stats = await getSubordinatesRequests(user.uid);
                        setDashboardData(stats);
                    }
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [user, isHOD]);

    // Calculate Dashboard Statistics
    const dashboardStats = useMemo(() => {
        let filtered = dashboardData;
        
        // Filter by Employee Name
        if (filterEmployee) {
            filtered = filtered.filter(r => r.employeeName.includes(filterEmployee));
        }

        // Filter by Month (based on Request Date in payload)
        filtered = filtered.filter(r => {
             const d = new Date(r.payload.date);
             return (d.getMonth() + 1) === Number(filterMonth);
        });

        const totalLateHours = filtered
            .filter(r => r.payload.permissionType === 'تأخر عن العمل')
            .reduce((acc, curr) => acc + (Number(curr.payload.durationMinutes) || 0), 0) / 60;
            
        const totalExitHours = filtered
            .filter(r => r.payload.permissionType === 'خروج أثناء الدوام')
            .reduce((acc, curr) => acc + (Number(curr.payload.durationMinutes) || 0), 0) / 60;

        return {
            requests: filtered,
            totalLateHours,
            totalExitHours,
            totalHours: totalLateHours + totalExitHours
        };
    }, [dashboardData, filterEmployee, filterMonth]);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                        {activeTab === 'INBOX' ? 'صندوق الوارد' : 'لوحة متابعة الأذونات'}
                    </h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        {activeTab === 'INBOX' ? 'الطلبات التي تتطلب إجراء منك.' : 'إحصائيات أذونات المرؤوسين.'}
                    </p>
                </div>
                
                {isHOD && (
                    <div className="flex space-x-2 space-x-reverse bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('INBOX')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'INBOX' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            المهام ({requests.length})
                        </button>
                        <button 
                             onClick={() => setActiveTab('DASHBOARD')}
                             className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'DASHBOARD' ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            الإحصائيات
                        </button>
                    </div>
                )}
            </div>
            
            {activeTab === 'INBOX' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    {loading ? (
                        <div className="flex justify-center"><Spinner /></div>
                    ) : requests.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">مقدم الطلب</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الخدمة</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">تاريخ الإنشاء</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الحالة</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {requests.map(req => (
                                        <tr key={req.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{req.employeeName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{req.serviceTitle}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{req.createdAt.toDate().toLocaleDateString('ar-EG')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChipClass(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                                <Link to={`/request/${req.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">
                                                    فتح
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">لا توجد طلبات في صندوق الوارد الخاص بك.</p>
                    )}
                </div>
            )}

            {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-500 mb-1">الشهر</label>
                            <select 
                                value={filterMonth} 
                                onChange={(e) => setFilterMonth(Number(e.target.value))}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-500 mb-1">اسم الموظف</label>
                            <input 
                                type="text" 
                                placeholder="بحث بالاسم..." 
                                value={filterEmployee}
                                onChange={(e) => setFilterEmployee(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300">إجمالي ساعات الإذن</h3>
                            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{dashboardStats.totalHours.toFixed(2)} س</p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-100 dark:border-yellow-800">
                             <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">تأخر عن العمل (8 صباحاً)</h3>
                             <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{dashboardStats.totalLateHours.toFixed(2)} س</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
                             <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">خروج أثناء الدوام</h3>
                             <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{dashboardStats.totalExitHours.toFixed(2)} س</p>
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">سجل الأذونات</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">الموظف</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">التاريخ</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">من - إلى</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">النوع</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">المدة</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {dashboardStats.requests.map(req => (
                                        <tr key={req.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{req.employeeName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{req.payload.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-xs font-mono">{req.payload.startTime} - {req.payload.endTime}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{req.payload.permissionType}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300">{(req.payload.durationMinutes/60).toFixed(2)} س</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChipClass(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {dashboardStats.requests.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-4 text-gray-500">لا توجد سجلات مطابقة.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerInbox;