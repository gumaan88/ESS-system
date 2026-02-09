import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAssignedRequests, getSubordinatesRequests } from '../services/firebaseService';
import { Request, RequestStatus, SystemRole } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';
import { 
    Briefcase, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    DoorOpen, 
    TrendingUp, 
    User,
    Calendar,
    Filter
} from 'lucide-react';

// --- COMPONENTS ---

const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    subValue?: string; 
    icon: React.ReactNode; 
    trend?: string;
    bgClass: string;
    textClass: string; 
}> = ({ title, value, subValue, icon, trend, bgClass, textClass }) => (
    <div className={`relative overflow-hidden ${bgClass} p-6 rounded-[2rem] border border-white/20 shadow-sm transition-all hover:shadow-md hover:-translate-y-1`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-md shadow-sm ${textClass}`}>
                {icon}
            </div>
            {trend && <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/50 text-gray-600">{trend}</span>}
        </div>
        <div>
            <h3 className="text-sm font-medium opacity-80 mb-1">{title}</h3>
            <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black">{value}</span>
                {subValue && <span className="text-sm font-bold opacity-60">{subValue}</span>}
            </div>
        </div>
    </div>
);

const ProgressBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
            <div 
                className={`h-full ${color} transition-all duration-1000 ease-out`} 
                style={{ width: `${percentage}%` }}
            ></div>
        </div>
    );
};

const LeaderboardItem: React.FC<{ rank: number; name: string; value: string; sub: string; avatarColor: string }> = ({ rank, name, value, sub, avatarColor }) => (
    <div className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors">
        <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${rank === 1 ? 'bg-yellow-100 text-yellow-700' : rank === 2 ? 'bg-gray-100 text-gray-600' : rank === 3 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>
            {rank}
        </div>
        <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold shadow-sm`}>
            {name.charAt(0)}
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{name}</h4>
            <p className="text-xs text-gray-500">{sub}</p>
        </div>
        <div className="text-right">
            <span className="block font-black text-gray-800 dark:text-white">{value}</span>
        </div>
    </div>
);

const ManagerInbox: React.FC = () => {
    const { user, employeeData } = useAuth();
    const [activeTab, setActiveTab] = useState<'INBOX' | 'ANALYTICS'>('INBOX');
    
    // Data
    const [inboxRequests, setInboxRequests] = useState<Request[]>([]);
    const [analyticsRequests, setAnalyticsRequests] = useState<Request[]>([]);
    
    // Loading States
    const [inboxLoading, setInboxLoading] = useState(true);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    
    // Errors
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);

    // Filters
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterMonth, setFilterMonth] = useState<number | 'ALL'>('ALL');

    const isManager = employeeData && [SystemRole.HOD, SystemRole.HR_SPECIALIST, SystemRole.HR_MANAGER, SystemRole.HR_ADMIN, SystemRole.CEO].includes(employeeData.systemRole);

    // Initial Fetch
    useEffect(() => {
        if (!user) return;

        const loadData = async () => {
            // 1. Load Inbox (Always)
            setInboxLoading(true);
            try {
                const assigned = await getAssignedRequests(user.uid);
                assigned.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setInboxRequests(assigned);
            } catch (e) {
                console.error("Inbox Load Error", e);
            } finally {
                setInboxLoading(false);
            }

            // 2. Load Analytics (If Manager) - Separated to avoid blocking inbox
            if (isManager) {
                setAnalyticsLoading(true);
                setAnalyticsError(null);
                try {
                    const subs = await getSubordinatesRequests(user.uid);
                    // Filter ONLY APPROVED requests for analytics as requested
                    const approvedOnly = subs.filter(r => r.status === RequestStatus.APPROVED);
                    setAnalyticsRequests(approvedOnly);
                    
                    // If we have 0 requests, check if it was actually a permission error in disguise?
                    // Firestore usually throws, caught here.
                } catch (e: any) {
                    console.error("Analytics Load Error", e);
                    if (e.code === 'permission-denied') {
                        setAnalyticsError("ليس لديك صلاحية لعرض بيانات الموظفين. يرجى مراجعة مسؤول النظام لتحديث قواعد البيانات.");
                    } else {
                        setAnalyticsError("حدث خطأ أثناء تحميل البيانات.");
                    }
                } finally {
                    setAnalyticsLoading(false);
                }
            }
        };

        loadData();
    }, [user, isManager]);

    // --- Analytics Computations ---
    const stats = useMemo(() => {
        // Filter by Date
        const filtered = analyticsRequests.filter(req => {
            if (!req.payload.date) return false;
            const d = new Date(req.payload.date);
            const reqYear = d.getFullYear();
            const reqMonth = d.getMonth() + 1;

            if (reqYear !== filterYear) return false;
            if (filterMonth !== 'ALL' && reqMonth !== filterMonth) return false;
            return true;
        });

        let totalLateMins = 0;
        let totalExitMins = 0;
        const empStats: Record<string, { name: string, late: number, exit: number, count: number }> = {};

        filtered.forEach(req => {
            const mins = Number(req.payload.durationMinutes) || 0;
            const type = req.payload.permissionType; // "تأخر عن العمل" or "خروج أثناء الدوام"
            const uid = req.employeeId;
            
            if (!empStats[uid]) empStats[uid] = { name: req.employeeName, late: 0, exit: 0, count: 0 };
            
            empStats[uid].count++;

            if (type === 'تأخر عن العمل') {
                totalLateMins += mins;
                empStats[uid].late += mins;
            } else {
                totalExitMins += mins;
                empStats[uid].exit += mins;
            }
        });

        const emps = Object.values(empStats);
        
        // Sorters
        const topLate = [...emps].sort((a, b) => b.late - a.late).slice(0, 3);
        const topExit = [...emps].sort((a, b) => b.exit - a.exit).slice(0, 3);
        const topCount = [...emps].sort((a, b) => b.count - a.count).slice(0, 3);

        const formatHM = (m: number) => {
            const h = Math.floor(m / 60);
            const min = Math.floor(m % 60);
            return `${h}:${min.toString().padStart(2, '0')}`;
        };

        return {
            totalRequests: filtered.length,
            totalLateStr: formatHM(totalLateMins),
            totalExitStr: formatHM(totalExitMins),
            totalLateMins,
            totalExitMins,
            topLate,
            topExit,
            topCount,
            filteredList: filtered
        };

    }, [analyticsRequests, filterYear, filterMonth]);

    const COLORS = ['bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">
                        {activeTab === 'INBOX' ? 'صندوق المهام' : 'التحليل والمتابعة'}
                    </h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium">
                        {activeTab === 'INBOX' ? 'المهام المعلقة التي تتطلب اتخاذ إجراء.' : 'نظرة شاملة على أداء الفريق (الطلبات المقبولة).'}
                    </p>
                </div>
                
                {isManager && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex font-bold text-sm">
                        <button 
                            onClick={() => setActiveTab('INBOX')}
                            className={`px-5 py-2 rounded-lg transition-all ${activeTab === 'INBOX' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            الوارد <span className="mr-1 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-md text-[10px]">{inboxRequests.length}</span>
                        </button>
                        <button 
                             onClick={() => setActiveTab('ANALYTICS')}
                             className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'ANALYTICS' ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <TrendingUp size={16} />
                            <span>التقارير</span>
                        </button>
                    </div>
                )}
            </div>

            {/* --- INBOX TAB --- */}
            {activeTab === 'INBOX' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px]">
                    {inboxLoading ? (
                        <div className="flex justify-center items-center h-64"><Spinner /></div>
                    ) : inboxRequests.length > 0 ? (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {inboxRequests.map(req => (
                                <div key={req.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${req.status === RequestStatus.RETURNED ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {req.status === RequestStatus.RETURNED ? '✏️' : '⏳'}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{req.serviceTitle}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <User size={14} /> {req.employeeName}
                                                <span className="text-gray-300">|</span>
                                                <Clock size={14} /> {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('ar-EG') : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${req.status === RequestStatus.RETURNED ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {req.status === RequestStatus.RETURNED ? 'بانتظار تعديل الموظف' : 'بانتظار موافقتك'}
                                        </div>
                                        <Link to={`/request/${req.id}`} className="flex-1 md:flex-none text-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                                            معاينة
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                            <div className="w-24 h-24 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center text-4xl mb-6 text-teal-600">
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">كل شيء على ما يرام!</h3>
                            <p className="text-gray-500 max-w-sm">لا توجد طلبات معلقة تتطلب انتباهك حالياً.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- ANALYTICS TAB --- */}
            {activeTab === 'ANALYTICS' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-2">
                    {/* Controls */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Filter size={20} className="text-teal-600" />
                            <span className="font-bold text-gray-700 dark:text-gray-200">تصفية النتائج:</span>
                         </div>
                         <div className="flex gap-3">
                             <select 
                                value={filterYear}
                                onChange={(e) => setFilterYear(Number(e.target.value))}
                                className="bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-2 font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500"
                             >
                                 <option value={currentYear}>{currentYear}</option>
                                 <option value={currentYear - 1}>{currentYear - 1}</option>
                             </select>
                             <select 
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="bg-gray-50 dark:bg-gray-700 border-none rounded-xl px-4 py-2 font-bold text-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500"
                             >
                                 <option value="ALL">طوال العام</option>
                                 {[...Array(12)].map((_, i) => (
                                     <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('ar-EG', { month: 'long' })}</option>
                                 ))}
                             </select>
                         </div>
                    </div>

                    {analyticsError ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-8 rounded-3xl text-center">
                            <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                            <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">تعذر تحميل البيانات</h3>
                            <p className="text-red-600 dark:text-red-400">{analyticsError}</p>
                        </div>
                    ) : analyticsLoading ? (
                        <div className="flex justify-center p-12"><Spinner /></div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatCard 
                                    title="عدد الأذونات (مقبولة)" 
                                    value={stats.totalRequests} 
                                    subValue="طلب"
                                    icon={<Briefcase size={24} />} 
                                    bgClass="bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                                    textClass="text-indigo-600"
                                />
                                <StatCard 
                                    title="ساعات التأخر" 
                                    value={stats.totalLateStr} 
                                    subValue="ساعة"
                                    icon={<Clock size={24} />} 
                                    bgClass="bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                                    textClass="text-orange-600"
                                />
                                <StatCard 
                                    title="ساعات الخروج" 
                                    value={stats.totalExitStr} 
                                    subValue="ساعة"
                                    icon={<DoorOpen size={24} />} 
                                    bgClass="bg-gradient-to-br from-teal-400 to-emerald-500 text-white"
                                    textClass="text-teal-600"
                                />
                            </div>

                            {/* Main Content Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                {/* LEADERBOARDS COLUMN */}
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Top Late */}
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={18} /></div>
                                            <h3 className="font-bold text-gray-800 dark:text-white">الأكثر تأخراً عن العمل</h3>
                                        </div>
                                        {stats.topLate.length > 0 ? (
                                            <div className="space-y-1">
                                                {stats.topLate.map((emp, i) => (
                                                    <LeaderboardItem 
                                                        key={i} 
                                                        rank={i+1} 
                                                        name={emp.name} 
                                                        value={(emp.late/60).toFixed(1)}
                                                        sub="ساعة"
                                                        avatarColor={COLORS[i % COLORS.length]}
                                                    />
                                                ))}
                                            </div>
                                        ) : <p className="text-center text-gray-400 py-8">لا توجد بيانات</p>}
                                    </div>

                                    {/* Top Exit */}
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg"><DoorOpen size={18} /></div>
                                            <h3 className="font-bold text-gray-800 dark:text-white">الأكثر خروجاً أثناء الدوام</h3>
                                        </div>
                                        {stats.topExit.length > 0 ? (
                                            <div className="space-y-1">
                                                {stats.topExit.map((emp, i) => (
                                                    <LeaderboardItem 
                                                        key={i} 
                                                        rank={i+1} 
                                                        name={emp.name} 
                                                        value={(emp.exit/60).toFixed(1)}
                                                        sub="ساعة"
                                                        avatarColor={COLORS[(i+2) % COLORS.length]}
                                                    />
                                                ))}
                                            </div>
                                        ) : <p className="text-center text-gray-400 py-8">لا توجد بيانات</p>}
                                    </div>

                                    {/* Top Requesters (Full Width) */}
                                    <div className="md:col-span-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                                        
                                        <div className="flex items-center gap-2 mb-6 relative z-10">
                                            <div className="p-2 bg-white/10 rounded-lg"><Briefcase size={18} /></div>
                                            <h3 className="font-bold">الأكثر طلباً للأذونات (بالعدد)</h3>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                                            {stats.topCount.map((emp, i) => (
                                                <div key={i} className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex items-center gap-3">
                                                    <div className="font-black text-2xl text-white/20">#{i+1}</div>
                                                    <div>
                                                        <div className="font-bold text-sm">{emp.name}</div>
                                                        <div className="text-xs text-white/60">{emp.count} طلب</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {stats.topCount.length === 0 && <p className="text-white/40 col-span-3 text-center">لا توجد بيانات</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* LIST COLUMN */}
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 h-fit">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-gray-800 dark:text-white">سجل الموافقات</h3>
                                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">{stats.totalRequests}</span>
                                    </div>
                                    
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                                        {stats.filteredList.slice(0, 20).map(req => (
                                            <Link to={`/request/${req.id}`} key={req.id} className="block group">
                                                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                    <div className={`mt-1 w-2 h-2 rounded-full ${req.payload.permissionType === 'تأخر عن العمل' ? 'bg-amber-500' : 'bg-teal-500'}`}></div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{req.employeeName}</span>
                                                            <span className="text-[10px] text-gray-400">{req.payload.date}</span>
                                                        </div>
                                                        <div className="flex justify-between mt-1">
                                                            <span className="text-xs text-gray-500">{req.payload.permissionType}</span>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{(Number(req.payload.durationMinutes)/60).toFixed(2)} س</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                        {stats.filteredList.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد سجلات مطابقة.</p>}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManagerInbox;