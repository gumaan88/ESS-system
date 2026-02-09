import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAssignedRequests, getSubordinatesRequests } from '../services/firebaseService';
import { Request, RequestStatus, SystemRole } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

// --- Utility Components ---

const StatusChip: React.FC<{ status: RequestStatus }> = ({ status }) => {
    const styles = {
        [RequestStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        [RequestStatus.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        [RequestStatus.REJECTED]: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
        [RequestStatus.RETURNED]: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        [RequestStatus.DRAFT]: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    
    const labels = {
        [RequestStatus.PENDING]: 'قيد الانتظار',
        [RequestStatus.APPROVED]: 'مقبول',
        [RequestStatus.REJECTED]: 'مرفوض',
        [RequestStatus.RETURNED]: 'معاد للتعديل',
        [RequestStatus.DRAFT]: 'مسودة',
    };

    return (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[status] || styles[RequestStatus.DRAFT]}`}>
            {labels[status] || status}
        </span>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: string; color: string }> = ({ title, value, subValue, icon, color }) => (
    <div className={`relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:shadow-md transition-all duration-300`}>
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500`}>
            <span className={`text-6xl ${color}`}>{icon}</span>
        </div>
        <div className="relative z-10">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
            <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black ${color.replace('text-', 'text-slate-800 dark:text-white ')}`}>{value}</span>
                {subValue && <span className="text-xs font-medium text-gray-400">{subValue}</span>}
            </div>
        </div>
        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent ${color.replace('text-', 'to-')} opacity-50`}></div>
    </div>
);

const EmployeeRankRow: React.FC<{ rank: number; name: string; value: string; label: string; maxVal: number; currentVal: number }> = ({ rank, name, value, label, maxVal, currentVal }) => {
    const percentage = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    
    return (
        <div className="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <div className="w-8 text-center font-bold text-lg grayscale opacity-80">{medal}</div>
            <div className="flex-1">
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{name}</span>
                    <span className="text-xs font-bold text-gray-500">{value} {label}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

const ManagerInbox: React.FC = () => {
    const { user, employeeData } = useAuth();
    const [activeTab, setActiveTab] = useState<'INBOX' | 'ANALYTICS'>('INBOX');
    
    // Data States
    const [inboxRequests, setInboxRequests] = useState<Request[]>([]);
    const [subordinatesRequests, setSubordinatesRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Filter States
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL'); // 'ALL' for yearly view

    const isManager = employeeData && [SystemRole.HOD, SystemRole.HR_SPECIALIST, SystemRole.HR_MANAGER, SystemRole.HR_ADMIN, SystemRole.CEO].includes(employeeData.systemRole);

    useEffect(() => {
        if (!user) return;
        
        const fetchAllData = async () => {
            setLoading(true);
            setErrorMsg(null);
            try {
                // 1. Fetch Actionable Inbox Items (Pending/Returned)
                const assigned = await getAssignedRequests(user.uid);
                assigned.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setInboxRequests(assigned);

                // 2. Fetch All Subordinates History (If Manager)
                if (isManager) {
                    const subsHistory = await getSubordinatesRequests(user.uid);
                    // Filter out DRAFTs, we want actual requests (Pending, Approved, Rejected)
                    const validHistory = subsHistory.filter(r => r.status !== RequestStatus.DRAFT);
                    validHistory.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                    setSubordinatesRequests(validHistory);
                }

            } catch (error: any) {
                console.error("Fetch Error:", error);
                if (error.code === 'permission-denied') {
                    setErrorMsg("تم رفض الوصول. يرجى التحقق من الصلاحيات.");
                } else {
                    setErrorMsg(error.message || "حدث خطأ غير معروف.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user, isManager]);


    // --- Analytics Logic ---

    const analyticsData = useMemo(() => {
        // Filter by Date
        const filtered = subordinatesRequests.filter(req => {
            // Only count APPROVED requests for accurate consumption stats
            // Or use PENDING + APPROVED if you want "Potential" consumption. 
            // Usually, stats are for Approved.
            if (req.status !== RequestStatus.APPROVED) return false;

            const dateStr = req.payload.date; // YYYY-MM-DD
            if (!dateStr) return false;
            
            const d = new Date(dateStr);
            const reqYear = d.getFullYear();
            const reqMonth = d.getMonth() + 1;

            if (reqYear !== selectedYear) return false;
            if (selectedMonth !== 'ALL' && reqMonth !== selectedMonth) return false;
            
            return true;
        });

        // Aggregation Variables
        let totalLateMinutes = 0;
        let totalExitMinutes = 0;
        let totalPermissionsCount = filtered.length;
        
        const employeeStats: Record<string, { name: string, lateMins: number, exitMins: number, count: number }> = {};

        filtered.forEach(req => {
            const mins = Number(req.payload.durationMinutes) || 0;
            const type = req.payload.permissionType; // "تأخر عن العمل" or "خروج أثناء الدوام"
            const empId = req.employeeId;
            const empName = req.employeeName;

            // Init Employee Entry
            if (!employeeStats[empId]) {
                employeeStats[empId] = { name: empName, lateMins: 0, exitMins: 0, count: 0 };
            }

            employeeStats[empId].count += 1;

            if (type === 'تأخر عن العمل') {
                totalLateMinutes += mins;
                employeeStats[empId].lateMins += mins;
            } else {
                // Assume exit or other types
                totalExitMinutes += mins;
                employeeStats[empId].exitMins += mins;
            }
        });

        // Convert Stats Object to Arrays for Ranking
        const employeesArray = Object.values(employeeStats);
        
        const topLate = [...employeesArray].sort((a, b) => b.lateMins - a.lateMins).slice(0, 5);
        const topExit = [...employeesArray].sort((a, b) => b.exitMins - a.exitMins).slice(0, 5);
        const topRequester = [...employeesArray].sort((a, b) => b.count - a.count).slice(0, 5);

        // Helper to format minutes to HH:MM
        const formatTime = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = Math.floor(mins % 60);
            return `${h}:${m.toString().padStart(2, '0')}`;
        };

        return {
            filteredRequests: filtered, // For the table list
            totalLate: formatTime(totalLateMinutes),
            totalExit: formatTime(totalExitMinutes),
            totalCount: totalPermissionsCount,
            topLate,
            topExit,
            topRequester
        };

    }, [subordinatesRequests, selectedYear, selectedMonth]);


    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">
                        {activeTab === 'INBOX' ? 'صندوق المهام' : 'لوحة القيادة والتحليل'}
                    </h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium">
                        {activeTab === 'INBOX' 
                            ? 'إدارة الطلبات الواردة واتخاذ القرارات.' 
                            : 'نظرة شاملة على أداء الفريق وسجل الأذونات.'}
                    </p>
                </div>
                
                {isManager && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl flex font-bold text-sm">
                        <button 
                            onClick={() => setActiveTab('INBOX')}
                            className={`px-6 py-2.5 rounded-xl transition-all shadow-sm ${activeTab === 'INBOX' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 shadow-none'}`}
                        >
                            الوارد ({inboxRequests.length})
                        </button>
                        <button 
                             onClick={() => setActiveTab('ANALYTICS')}
                             className={`px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 ${activeTab === 'ANALYTICS' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 shadow-none'}`}
                        >
                            <span>التقارير</span>
                            <span className="text-[10px] bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 px-1.5 py-0.5 rounded-md">جديد</span>
                        </button>
                    </div>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <p>{errorMsg}</p>
                </div>
            )}

            {/* --- TAB: INBOX --- */}
            {activeTab === 'INBOX' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex justify-center"><Spinner /></div>
                    ) : inboxRequests.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="px-6 py-4">الموظف</th>
                                        <th className="px-6 py-4">الخدمة</th>
                                        <th className="px-6 py-4">تاريخ الطلب</th>
                                        <th className="px-6 py-4">الحالة</th>
                                        <th className="px-6 py-4">الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {inboxRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{req.employeeName}</div>
                                                <div className="text-xs text-gray-400">{req.department}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {req.serviceTitle}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('ar-EG') : '-'}
                                                <div className="text-xs text-gray-300 mt-0.5">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}) : ''}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusChip status={req.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <Link 
                                                    to={`/request/${req.id}`} 
                                                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-bold text-sm bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg hover:shadow-sm transition-all"
                                                >
                                                    <span>معاينة</span>
                                                    <span className="group-hover:translate-x-[-2px] transition-transform">←</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-24 px-6">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🎉</div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">رائع! لا توجد مهام معلقة</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">لقد قمت بإتمام جميع المهام المسندة إليك. يمكنك الانتقال إلى قسم التقارير لمتابعة أداء الفريق.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB: ANALYTICS --- */}
            {activeTab === 'ANALYTICS' && (
                <div className="space-y-6">
                    {/* Filters Bar */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white px-2">إحصائيات الأذونات (المقبولة فقط)</h2>
                        <div className="flex gap-3">
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-gray-50 dark:bg-gray-700 border-0 rounded-xl px-4 py-2 font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500"
                            >
                                <option value={2024}>2024</option>
                                <option value={2025}>2025</option>
                            </select>
                            <select 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="bg-gray-50 dark:bg-gray-700 border-0 rounded-xl px-4 py-2 font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="ALL">طوال العام</option>
                                {[...Array(12)].map((_, i) => (
                                    <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('ar-EG', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Bento Grid - Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Card 1: Late Hours */}
                        <StatCard 
                            title="إجمالي ساعات التأخر" 
                            value={analyticsData.totalLate} 
                            subValue="ساعة:دقيقة"
                            icon="⏰" 
                            color="text-amber-500" 
                        />
                         {/* Card 2: Exit Hours */}
                         <StatCard 
                            title="إجمالي ساعات الخروج" 
                            value={analyticsData.totalExit} 
                            subValue="ساعة:دقيقة"
                            icon="🏃" 
                            color="text-indigo-500" 
                        />
                         {/* Card 3: Total Requests */}
                         <StatCard 
                            title="عدد الأذونات المقبولة" 
                            value={analyticsData.totalCount} 
                            subValue="طلب"
                            icon="📝" 
                            color="text-teal-600" 
                        />
                    </div>

                    {/* Leaderboards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Late Employees */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="bg-amber-100 p-1.5 rounded-lg text-amber-600 text-lg">⚠️</span>
                                الأكثر تأخراً عن العمل
                            </h3>
                            {analyticsData.topLate.length > 0 ? (
                                <div className="space-y-1">
                                    {analyticsData.topLate.map((emp, idx) => (
                                        <EmployeeRankRow 
                                            key={idx} 
                                            rank={idx + 1} 
                                            name={emp.name} 
                                            value={(emp.lateMins / 60).toFixed(1)} 
                                            label="ساعة"
                                            maxVal={analyticsData.topLate[0].lateMins}
                                            currentVal={emp.lateMins}
                                        />
                                    ))}
                                </div>
                            ) : <p className="text-gray-400 text-sm text-center py-6">لا توجد بيانات</p>}
                        </div>

                        {/* Top Exit Employees */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600 text-lg">🚪</span>
                                الأكثر خروجاً أثناء الدوام
                            </h3>
                            {analyticsData.topExit.length > 0 ? (
                                <div className="space-y-1">
                                    {analyticsData.topExit.map((emp, idx) => (
                                        <EmployeeRankRow 
                                            key={idx} 
                                            rank={idx + 1} 
                                            name={emp.name} 
                                            value={(emp.exitMins / 60).toFixed(1)} 
                                            label="ساعة"
                                            maxVal={analyticsData.topExit[0].exitMins}
                                            currentVal={emp.exitMins}
                                        />
                                    ))}
                                </div>
                            ) : <p className="text-gray-400 text-sm text-center py-6">لا توجد بيانات</p>}
                        </div>
                    </div>
                    
                    {/* Top Requesters (Count) */}
                    <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-3xl shadow-lg p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-20 -mt-20"></div>
                        <h3 className="font-bold text-lg mb-4 relative z-10 flex items-center gap-2">
                             <span>📊</span> الأكثر طلباً للأذونات (بالعدد)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                            {analyticsData.topRequester.slice(0, 4).map((emp, idx) => (
                                <div key={idx} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-white text-teal-700 flex items-center justify-center font-black mb-2 shadow-lg">
                                        {idx + 1}
                                    </div>
                                    <span className="font-bold text-sm truncate w-full">{emp.name}</span>
                                    <span className="text-xs text-teal-100 mt-1">{emp.count} طلب</span>
                                </div>
                            ))}
                            {analyticsData.topRequester.length === 0 && <p className="text-teal-200 text-sm col-span-4 text-center">لا توجد بيانات</p>}
                        </div>
                    </div>

                    {/* Detailed Team Requests List */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-6 text-xl">سجل طلبات الفريق (التفاصيل)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-500 dark:text-gray-400 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="px-4 py-3 rounded-r-lg">الموظف</th>
                                        <th className="px-4 py-3">التاريخ</th>
                                        <th className="px-4 py-3">النوع</th>
                                        <th className="px-4 py-3">المدة</th>
                                        <th className="px-4 py-3 rounded-l-lg">الحالة</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {subordinatesRequests
                                        .filter(r => {
                                            if (selectedMonth === 'ALL') return true; // Just basic list filter for month if needed, but usually list shows all or paginated. 
                                            // Let's adhere to the global filters for the list too
                                            if (!r.payload.date) return false;
                                            const d = new Date(r.payload.date);
                                            return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
                                        })
                                        .slice(0, 10) // Limit to 10 for display
                                        .map(req => (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{req.employeeName}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{req.payload.date}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {req.payload.permissionType === 'تأخر عن العمل' ? '⏰ تأخر' : '🏃 خروج'}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300">
                                                {req.payload.durationHours ? Number(req.payload.durationHours).toFixed(2) + ' س' : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusChip status={req.status} />
                                            </td>
                                            <td className="px-4 py-3 text-left">
                                                 <Link to={`/request/${req.id}`} className="text-teal-600 hover:underline text-xs font-bold">عرض</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {subordinatesRequests.length === 0 && <p className="text-center py-6 text-gray-400">لا توجد سجلات.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerInbox;