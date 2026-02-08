import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest, getMonthlyPermissionUsage } from '../services/firebaseService';
import { ServiceDefinition, FieldType, FormField } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { uploadFile } from '../services/gasService';
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
    // Calculate percentage for background gradient and thumb position
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="w-full mb-6 relative">
            <div className="flex justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            
            <div className="relative w-full h-10 flex items-center">
                {/* Track Background */}
                <div className="absolute w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-75 ease-out" 
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* The Range Input (Invisible but interactive) */}
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Custom Thumb & Floating Value Bubble */}
                <div 
                    className="absolute h-8 w-8 bg-white dark:bg-gray-800 border-2 border-indigo-500 rounded-full shadow-lg flex items-center justify-center pointer-events-none transition-all duration-75 ease-out z-0"
                    style={{ 
                        left: `calc(${percentage}% - 16px)` // Center the 32px thumb
                    }}
                >
                    {/* The Value Tooltip above thumb */}
                    <div className="absolute -top-10 bg-indigo-600 text-white text-xs font-bold py-1 px-2 rounded transform -translate-x-0 shadow-sm whitespace-nowrap">
                        {formatValue ? formatValue(value) : value}
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-indigo-600 rotate-45"></div>
                    </div>
                    
                    {/* Inner Dot */}
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

const DynamicField: React.FC<{ field: FormField; value: any; onChange: (id: string, value: any) => void; }> = ({ field, value, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        onChange(field.id, e.target.value);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onChange(field.id, e.target.files[0]);
        }
    };

    switch (field.type) {
        case FieldType.TEXT:
        case FieldType.NUMBER:
        case FieldType.DATE:
        case FieldType.TIME:
            return <input type={field.type} id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />;
        case FieldType.TEXTAREA:
             return <textarea id={field.id} value={value || ''} onChange={handleChange} required={field.required} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />;
        case FieldType.SELECT:
            return (
                <select id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="">اختر...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        case FieldType.FILE:
            return <input type="file" id={field.id} onChange={handleFileChange} required={field.required} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:text-gray-400 dark:file:bg-indigo-900 dark:file:text-indigo-300 dark:hover:file:bg-indigo-800"/>;
        default:
            return null;
    }
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

    // Slider States
    const [startHour, setStartHour] = useState(8);
    const [startMinute, setStartMinute] = useState(0);
    const [endHour, setEndHour] = useState(10);
    const [endMinute, setEndMinute] = useState(0);

    const isPermissionService = serviceId === 'permission_request';

    useEffect(() => {
        if (!serviceId) return;
        const fetchService = async () => {
            setLoading(true);
            try {
                const serviceDef = await getServiceDefinition(serviceId);
                setService(serviceDef);
                
                if (serviceDef.id === 'permission_request' && user) {
                    const now = new Date();
                    const used = await getMonthlyPermissionUsage(user.uid, now.getMonth(), now.getFullYear());
                    setPermissionUsage(used);
                    // Default Date to today
                    setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
                }
            } catch (err) {
                setError("لا يمكن تحميل تعريف الخدمة.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId, user]);

    // Update formData when sliders change
    useEffect(() => {
        if (isPermissionService) {
            const formattedStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
            const formattedEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
            setFormData(prev => ({
                ...prev,
                startTime: formattedStart,
                endTime: formattedEnd
            }));
        }
    }, [startHour, startMinute, endHour, endMinute, isPermissionService]);

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
        if (!isPermissionService) return { valid: true };

        const { startTime, endTime, date } = data;
        if (!date) return { valid: false, error: "يرجى تحديد التاريخ." };

        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;
        
        if (endTotalMinutes <= startTotalMinutes) {
            return { valid: false, error: "وقت النهاية يجب أن يكون بعد وقت البداية." };
        }

        const durationMinutes = endTotalMinutes - startTotalMinutes;
        const durationHours = durationMinutes / 60;

        // Check 8 AM rule (allow margin of 5 mins for lateness logic maybe? sticking to strict 08:00 for now)
        let type = "خروج أثناء الدوام";
        if (startHour === 8 && startMinute === 0) {
            type = "تأخر عن العمل";
        }

        // Check Limit
        const currentUsage = permissionUsage || 0;
        if ((currentUsage + durationHours) > 8) {
            return { valid: false, error: `لا يمكنك تقديم الطلب. رصيدك المستخدم: ${currentUsage.toFixed(2)} ساعة. الطلب الحالي: ${durationHours.toFixed(2)} ساعة. الإجمالي سيتجاوز 8 ساعات.` };
        }

        return { valid: true, calculatedType: type, durationMinutes };
    };

    const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
        e.preventDefault();
        if (!service || !user || !employeeData) {
            setError("بيانات المستخدم أو الخدمة غير متوفرة.");
            return;
        }
        
        let finalPayload = { ...formData };
        if (isPermissionService) {
            const validation = validatePermissionLogic(formData);
            if (!validation.valid) {
                setError(validation.error || "خطأ في التحقق");
                return;
            }
            finalPayload.type = validation.calculatedType;
            finalPayload.durationMinutes = validation.durationMinutes;
            finalPayload.durationHours = (validation.durationMinutes || 0) / 60;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            for (const field of service.fields) {
                // Skip file logic if field is hidden/not used, but here generic logic holds
                if (field.type === FieldType.FILE && finalPayload[field.id]) {
                    const file = finalPayload[field.id] as File;
                    const fileUrl = await uploadFile(file); 
                    payload[field.id] = fileUrl;
                } else {
                    payload[field.id] = finalPayload[field.id];
                }
            }
            
            if (isPermissionService) {
                payload.permissionType = finalPayload.type;
                payload.durationMinutes = finalPayload.durationMinutes;
            }
            
            await createRequest(user.uid, employeeData.name, service, payload, isDraft);
            navigate('/dashboard');

        } catch (err) {
            setError("فشل إنشاء الطلب. يرجى المحاولة مرة أخرى.");
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    if (!service) return <p className="text-center text-red-500">{error || "لم يتم العثور على الخدمة."}</p>;

    const pad = (n: number) => String(n).padStart(2, '0');

    return (
        <div>
            <Notification message={error} type="error" onClose={() => setError('')} />
            
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{service.title}</h1>
                     <p className="text-gray-500 dark:text-gray-400">يرجى ملء النموذج التالي لتقديم طلبك.</p>
                </div>
                {isPermissionService && permissionUsage !== null && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 text-center">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">الرصيد المستخدم</span>
                        <span className={`text-lg font-bold ${permissionUsage >= 8 ? 'text-red-600' : 'text-indigo-600'}`}>
                            {permissionUsage.toFixed(2)} / 8.00 <span className="text-xs">ساعة</span>
                        </span>
                    </div>
                )}
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                
                {/* 1. Generic Fields (Except Time for Permission Request) */}
                {service.fields.map(field => {
                    // Hide generic time inputs for permission service to use Custom UI
                    if (isPermissionService && (field.id === 'startTime' || field.id === 'endTime')) return null;
                    
                    return (
                        <div key={field.id}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                            <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                        </div>
                    );
                })}

                {/* 2. Custom Elegant Slider UI for Permissions */}
                {isPermissionService && (
                    <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <span>⏱️</span> تحديد الوقت
                            </h3>
                            <div className="text-right">
                                <span className="text-xs text-gray-500 block">المدة المحتسبة</span>
                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {Math.floor(currentDuration / 60)} <span className="text-xs">ساعة</span> و {currentDuration % 60} <span className="text-xs">دقيقة</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* FROM Section */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2 mb-4 border-b pb-2 dark:border-gray-700">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">من الساعة</span>
                                    <span className="mr-auto font-mono text-lg bg-green-100 text-green-800 px-2 rounded dark:bg-green-900 dark:text-green-300">
                                        {pad(startHour)}:{pad(startMinute)}
                                    </span>
                                </div>
                                <ElegantSlider 
                                    label="الساعة" 
                                    min={0} max={23} 
                                    value={startHour} 
                                    onChange={setStartHour} 
                                    formatValue={(v) => pad(v)}
                                />
                                <ElegantSlider 
                                    label="الدقيقة" 
                                    min={0} max={59} 
                                    value={startMinute} 
                                    onChange={setStartMinute}
                                    formatValue={(v) => pad(v)} 
                                />
                            </div>

                            {/* TO Section */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2 mb-4 border-b pb-2 dark:border-gray-700">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">إلى الساعة</span>
                                    <span className="mr-auto font-mono text-lg bg-red-100 text-red-800 px-2 rounded dark:bg-red-900 dark:text-red-300">
                                        {pad(endHour)}:{pad(endMinute)}
                                    </span>
                                </div>
                                <ElegantSlider 
                                    label="الساعة" 
                                    min={0} max={23} 
                                    value={endHour} 
                                    onChange={setEndHour}
                                    formatValue={(v) => pad(v)}
                                />
                                <ElegantSlider 
                                    label="الدقيقة" 
                                    min={0} max={59} 
                                    value={endMinute} 
                                    onChange={setEndMinute}
                                    formatValue={(v) => pad(v)}
                                />
                            </div>
                        </div>

                         <div className="mt-4 flex justify-center">
                            <span className={`px-4 py-1 rounded-full text-sm font-semibold ${startHour === 8 && startMinute === 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                تصنيف الإذن: {startHour === 8 && startMinute === 0 ? "تأخر عن العمل" : "خروج أثناء الدوام"}
                            </span>
                        </div>
                    </div>
                )}

                <div className="pt-5 border-t dark:border-gray-700 mt-6">
                    <div className="flex justify-end space-x-3 space-x-reverse">
                        <button type="button" onClick={() => navigate(-1)} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                            إلغاء
                        </button>
                        
                        <button 
                            type="button" 
                            onClick={(e) => handleSubmit(e as any, true)} 
                            disabled={submitting}
                            className="inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            حفظ كمسودة
                        </button>

                        <button type="submit" disabled={submitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                            {submitting ? 'جاري الإرسال...' : 'إرسال للموافقة'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default RequestForm;
