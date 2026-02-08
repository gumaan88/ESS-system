import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest, getMonthlyPermissionUsage } from '../services/firebaseService';
import { ServiceDefinition, FieldType, FormField } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import Notification from '../components/Notification';

// --- Elegant Slider Component ---
interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    formatValue?: (val: number) => string;
}

const ElegantSlider: React.FC<SliderProps> = ({ label, value, min, max, onChange, formatValue }) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="w-full mb-6 relative px-2">
            <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            
            <div className="relative w-full h-10 flex items-center group">
                <div className="absolute w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-l from-indigo-500 to-purple-600 transition-all duration-150 ease-out" 
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div 
                    className="absolute h-8 w-8 bg-white dark:bg-gray-800 border-4 border-indigo-500 rounded-full shadow-xl flex items-center justify-center pointer-events-none transition-all duration-75 ease-out z-10"
                    style={{ left: `calc(${percentage}% - 16px)` }}
                >
                    <div className="absolute -top-12 bg-gray-900 text-white text-sm font-bold py-1 px-3 rounded-lg transform -translate-x-0 shadow-lg whitespace-nowrap transition-transform scale-100 origin-bottom">
                        {formatValue ? formatValue(value) : value}
                        <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RequestForm: React.FC = () => {
    const { serviceId } = useParams<{ serviceId: string }>();
    const navigate = useNavigate();
    const { user, employeeData } = useAuth();
    
    const [service, setService] = useState<ServiceDefinition | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [permissionUsage, setPermissionUsage] = useState<number | null>(null);

    // Slider States (Default 8:00 AM to 10:00 AM)
    const [startHour, setStartHour] = useState(8);
    const [startMinute, setStartMinute] = useState(0);
    const [endHour, setEndHour] = useState(10);
    const [endMinute, setEndMinute] = useState(0);

    useEffect(() => {
        if (!serviceId) return;
        const fetchService = async () => {
            setLoading(true);
            try {
                const serviceDef = await getServiceDefinition(serviceId);
                setService(serviceDef);
                
                // Permission Request Logic
                if (serviceDef.id === 'permission_request' && user) {
                    const now = new Date();
                    const used = await getMonthlyPermissionUsage(user.uid, now.getMonth(), now.getFullYear());
                    setPermissionUsage(used);
                    // Default Date to today
                    setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
                }
            } catch (err) {
                setError("الخدمة المطلوبة غير متاحة حالياً.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId, user]);

    // Update formData when sliders change
    useEffect(() => {
        const formattedStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
        const formattedEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
        setFormData(prev => ({
            ...prev,
            startTime: formattedStart,
            endTime: formattedEnd
        }));
    }, [startHour, startMinute, endHour, endMinute]);

    const handleFormChange = (id: string, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    // Calculate duration for display
    const currentDuration = useMemo(() => {
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        const diff = end - start;
        return diff > 0 ? diff : 0;
    }, [startHour, startMinute, endHour, endMinute]);

    const validatePermissionLogic = (data: Record<string, any>): { valid: boolean; error?: string; calculatedType?: string; durationMinutes?: number } => {
        const { date, reason } = data;
        if (!date) return { valid: false, error: "يرجى تحديد التاريخ." };
        if (!reason || reason.trim() === "") return { valid: false, error: "يرجى كتابة سبب الإذن." };

        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        
        if (endTotalMinutes <= startTotalMinutes) {
            return { valid: false, error: "وقت النهاية يجب أن يكون بعد وقت البداية." };
        }

        const durationMinutes = endTotalMinutes - startTotalMinutes;
        const durationHours = durationMinutes / 60;

        let type = "خروج أثناء الدوام";
        if (startHour === 8 && startMinute === 0) {
            type = "تأخر عن العمل";
        }

        const currentUsage = permissionUsage || 0;
        if ((currentUsage + durationHours) > 8) {
            return { valid: false, error: `لا يمكنك تقديم الطلب. رصيدك المستخدم: ${currentUsage.toFixed(2)} ساعة. الطلب الحالي: ${durationHours.toFixed(2)} ساعة. الإجمالي سيتجاوز 8 ساعات.` };
        }

        return { valid: true, calculatedType: type, durationMinutes };
    };

    const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
        e.preventDefault();
        if (!service || !user || !employeeData) return;
        
        const validation = validatePermissionLogic(formData);
        if (!validation.valid) {
            setError(validation.error || "خطأ في التحقق");
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const finalPayload = {
                ...formData,
                permissionType: validation.calculatedType,
                durationMinutes: validation.durationMinutes,
                durationHours: (validation.durationMinutes || 0) / 60
            };
            
            await createRequest(user.uid, employeeData.name, service, finalPayload, isDraft);
            navigate('/dashboard');
        } catch (err) {
            setError("فشل إنشاء الطلب. يرجى المحاولة مرة أخرى.");
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    if (!service) return <p className="text-center text-red-500">{error}</p>;

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        <div>
            <Notification message={error} type="error" onClose={() => setError('')} />
            
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{service.title}</h1>
                     <p className="text-gray-500 dark:text-gray-400">يرجى ملء النموذج التالي لتقديم طلبك.</p>
                </div>
                {permissionUsage !== null && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 text-center">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">الرصيد المستخدم (شهري)</span>
                        <span className={`text-lg font-bold ${permissionUsage >= 8 ? 'text-red-600' : 'text-indigo-600'}`}>
                            {permissionUsage.toFixed(2)} / 8.00 <span className="text-xs">ساعة</span>
                        </span>
                    </div>
                )}
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                
                {/* Date Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ الإذن *</label>
                    <input 
                        type="date" 
                        value={formData.date || ''} 
                        onChange={(e) => handleFormChange('date', e.target.value)} 
                        required 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                    />
                </div>

                {/* Elegant Slider UI */}
                <div className="mt-8 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl border border-indigo-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">⏱️</span> تحديد مدة الإذن
                        </h3>
                        <div className="text-right bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 block">المدة المحتسبة</span>
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                                {Math.floor(currentDuration / 60)}<span className="text-sm font-normal text-gray-400 mx-1">س</span> 
                                {currentDuration % 60}<span className="text-sm font-normal text-gray-400 mx-1">د</span>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                        {/* FROM Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-t-4 border-green-500 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-bl-full -mr-10 -mt-10"></div>
                            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 relative z-10">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 font-bold text-xs">من</div>
                                <span className="font-bold text-gray-700 dark:text-gray-200 text-lg">وقت البداية</span>
                                <span className="mr-auto font-mono text-2xl font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-lg">
                                    {pad(startHour)}:{pad(startMinute)}
                                </span>
                            </div>
                            <div className="space-y-6 relative z-10">
                                <ElegantSlider label="الساعة" min={0} max={23} value={startHour} onChange={setStartHour} formatValue={(v) => pad(v)} />
                                <ElegantSlider label="الدقيقة" min={0} max={59} value={startMinute} onChange={setStartMinute} formatValue={(v) => pad(v)} />
                            </div>
                        </div>

                        {/* TO Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-t-4 border-red-500 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-bl-full -mr-10 -mt-10"></div>
                            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 relative z-10">
                                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 font-bold text-xs">إلى</div>
                                <span className="font-bold text-gray-700 dark:text-gray-200 text-lg">وقت النهاية</span>
                                <span className="mr-auto font-mono text-2xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1 rounded-lg">
                                    {pad(endHour)}:{pad(endMinute)}
                                </span>
                            </div>
                            <div className="space-y-6 relative z-10">
                                <ElegantSlider label="الساعة" min={0} max={23} value={endHour} onChange={set