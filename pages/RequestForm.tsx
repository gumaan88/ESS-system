import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest, getMonthlyPermissionUsage } from '../services/firebaseService';
import { ServiceDefinition, FieldType, FormField } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import Notification from '../components/Notification';
import { uploadFile } from '../services/gasService';

// --- Components ---

interface TimeInputProps {
    label: string;
    hour: number;
    minute: number;
    onHourChange: (val: number) => void;
    onMinuteChange: (val: number) => void;
    colorClass: string;
}

const TimeInput: React.FC<TimeInputProps> = ({ label, hour, minute, onHourChange, onMinuteChange, colorClass }) => {
    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value) || 0;
        // Clamp visually for UX, though logic handles validation
        if (val < 0) val = 0; 
        if (val > 23) val = 23;
        onHourChange(val);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value) || 0;
        if (val < 0) val = 0;
        if (val > 59) val = 59;
        onMinuteChange(val);
    };

    return (
        <div className={`flex flex-col items-center bg-white dark:bg-gray-800 p-3 rounded-xl border-2 ${colorClass} shadow-sm w-full`}>
            <span className="text-xs font-bold text-gray-500 mb-2">{label}</span>
            <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                    <input 
                        type="number" 
                        min="8" max="16" 
                        value={hour.toString().padStart(2, '0')}
                        onChange={handleHourChange}
                        onFocus={(e) => e.target.select()}
                        className="w-12 h-10 text-center text-xl font-bold bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-400 mt-1">ساعة</span>
                </div>
                <span className="text-xl font-bold text-gray-400 pb-4">:</span>
                <div className="flex flex-col items-center">
                    <input 
                        type="number" 
                        min="0" max="59" step="5"
                        value={minute.toString().padStart(2, '0')}
                        onChange={handleMinuteChange}
                        onFocus={(e) => e.target.select()}
                        className="w-12 h-10 text-center text-xl font-bold bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-400 mt-1">دقيقة</span>
                </div>
            </div>
        </div>
    );
};

interface CircularTimePickerProps {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    onChangeStart: (h: number, m: number) => void;
    onChangeEnd: (h: number, m: number) => void;
}

const CircularTimePicker: React.FC<CircularTimePickerProps> = ({ 
    startHour, startMinute, endHour, endMinute, onChangeStart, onChangeEnd 
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);

    const CX = 140; 
    const CY = 140; 
    const R = 100;  
    const SIZE = 280;

    // Convert time to angle (Linear mapping for smooth movement)
    // 8:00 (480 min) -> 240 degrees
    // 16:00 (960 min) -> 480 degrees (which is 120 visually)
    // Range is 8 hours = 480 minutes.
    // Degrees Span = 240 deg.
    // Function: time -> minutes from 8am -> degrees from 240.
    const timeToAngle = (h: number, m: number) => {
        const totalMinutes = h * 60 + m;
        const minutesFrom8 = totalMinutes - 480; // 8:00 is 480 min
        // 480 minutes covers 240 degrees (from 240 to 120 passing through 0)
        // Ratio: 0.5 degree per minute
        let angle = 240 + (minutesFrom8 * 0.5);
        return angle % 360;
    };

    // Convert angle to time (Linear mapping inverse)
    const angleToTime = (angle: number) => {
        // Normalize angle so 0 is at 3 o'clock in math, but we use clock coordinates where 0 is 12.
        // Our clock coordinates: 0 is 12, 90 is 3, 180 is 6, 270 is 9.
        // Valid visual range: 240 (8am) -> 360/0 (12pm) -> 120 (4pm).
        
        // Normalize logic:
        // We want a linear value "degFrom240".
        // If angle >= 240: degFrom240 = angle - 240.
        // If angle <= 120: degFrom240 = angle + 120.
        // Gap area (120 < angle < 240): Snap to nearest.
        
        let degFrom240 = 0;
        if (angle >= 240) {
            degFrom240 = angle - 240;
        } else if (angle <= 120) {
            degFrom240 = angle + 120; // e.g. 0 (12pm) becomes 120 deg from start. 120 (4pm) becomes 240.
        } else {
            // In the dead zone (bottom of clock)
            // 180 is 6 o'clock.
            if (angle < 180) degFrom240 = 240; // Snap to max (4pm)
            else degFrom240 = 0; // Snap to min (8am)
        }

        // minutes = degFrom240 / 0.5 => degFrom240 * 2
        const minutesFrom8 = degFrom240 * 2;
        const totalMinutes = 480 + minutesFrom8;

        let h = Math.floor(totalMinutes / 60);
        let m = Math.floor(totalMinutes % 60);

        // Snap to nearest 5 minutes
        m = Math.round(m / 5) * 5;
        if (m === 60) { m = 0; h += 1; }

        // Hard clamp limits
        if (h < 8) return { h: 8, m: 0 };
        if (h > 16 || (h === 16 && m > 0)) return { h: 16, m: 0 };

        return { h, m };
    };

    const handleMove = (e: MouseEvent | TouchEvent, isStart: boolean) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        const x = clientX - rect.left - CX;
        const y = clientY - rect.top - CY;

        // Angle from 12 o'clock CW
        let angleDeg = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angleDeg < 0) angleDeg += 360;

        const { h, m } = angleToTime(angleDeg);

        if (isStart) {
            // Prevent pushing end time
            const startMins = h * 60 + m;
            const endMins = endHour * 60 + endMinute;
            if (startMins < endMins) onChangeStart(h, m);
        } else {
            // Prevent pushing start time
            const startMins = startHour * 60 + startMinute;
            const endMins = h * 60 + m;
            if (endMins > startMins) onChangeEnd(h, m);
        }
    };

    useEffect(() => {
        const handleUp = () => { setIsDraggingStart(false); setIsDraggingEnd(false); };
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (isDraggingStart) handleMove(e, true);
            if (isDraggingEnd) handleMove(e, false);
        };
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('touchmove', handleGlobalMove);
        };
    }, [isDraggingStart, isDraggingEnd, startHour, startMinute, endHour, endMinute]);

    const polarToCartesian = (angle: number, r: number = R) => {
        const rad = (angle - 90) * Math.PI / 180.0;
        return { x: CX + (r * Math.cos(rad)), y: CY + (r * Math.sin(rad)) };
    };

    // Draw Arc
    const startAngle = timeToAngle(startHour, startMinute);
    const endAngle = timeToAngle(endHour, endMinute);
    
    // SVG Path for Arc
    let diff = endAngle - startAngle;
    if (diff < 0) diff += 360;
    const largeArc = diff > 180 ? 1 : 0;
    const startPt = polarToCartesian(endAngle); // Path goes backwards visually? No, usually Start -> End
    // Let's draw strictly from Start Angle to End Angle
    // For SVG 'A', we need start point and end point.
    // Move to Start Point
    const p1 = polarToCartesian(startAngle);
    const p2 = polarToCartesian(endAngle);
    const arcPath = `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;

    // Decorations
    const numbers = [8, 9, 10, 11, 12, 1, 2, 3, 4];

    return (
        <div className="flex items-center justify-center select-none scale-90 sm:scale-100">
            <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="cursor-pointer">
                {/* Background Circle */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth="24" className="dark:stroke-gray-700" />
                
                {/* Active Arc */}
                <path d={arcPath} fill="none" stroke="#6366f1" strokeWidth="24" strokeLinecap="round" className="opacity-40" />
                
                {/* Ticks/Numbers */}
                {numbers.map(num => {
                    // Convert 12h num to 24h for angle calc
                    let h24 = num;
                    if (num >= 1 && num <= 4) h24 += 12;
                    const ang = timeToAngle(h24, 0);
                    const pos = polarToCartesian(ang, R - 40);
                    return <text key={num} x={pos.x} y={pos.y} dy="5" textAnchor="middle" className="text-xs font-bold fill-gray-400 pointer-events-none">{num}</text>;
                })}

                {/* Handles */}
                <g transform={`translate(${p1.x}, ${p1.y})`} onMouseDown={() => setIsDraggingStart(true)} onTouchStart={() => setIsDraggingStart(true)} className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                    <circle r="18" fill="white" className="drop-shadow-md" />
                    <circle r="12" fill="#10b981" />
                    <text dy="4" textAnchor="middle" className="text-[10px] font-bold fill-white pointer-events-none">من</text>
                </g>
                <g transform={`translate(${p2.x}, ${p2.y})`} onMouseDown={() => setIsDraggingEnd(true)} onTouchStart={() => setIsDraggingEnd(true)} className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                    <circle r="18" fill="white" className="drop-shadow-md" />
                    <circle r="12" fill="#ef4444" />
                    <text dy="4" textAnchor="middle" className="text-[10px] font-bold fill-white pointer-events-none">إلى</text>
                </g>

                {/* Center Text */}
                <text x={CX} y={CY - 10} textAnchor="middle" className="text-sm fill-gray-400 dark:fill-gray-500 font-medium">المدة</text>
                <text x={CX} y={CY + 15} textAnchor="middle" className="text-2xl fill-indigo-600 dark:fill-indigo-400 font-bold">
                    {Math.floor((endHour * 60 + endMinute - (startHour * 60 + startMinute))/60)}:{(endHour * 60 + endMinute - (startHour * 60 + startMinute))%60 || '00'}
                </text>
            </svg>
        </div>
    );
};

const UsageProgressBar: React.FC<{ used: number; current: number; total: number }> = ({ used, current, total }) => {
    const usedPercent = Math.min((used / total) * 100, 100);
    const currentPercent = Math.min((current / total) * 100, 100 - usedPercent);
    const remaining = Math.max(total - used - current, 0);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                <span>المستخدم ({used.toFixed(2)} س)</span>
                <span>المتبقي ({remaining.toFixed(2)} س)</span>
            </div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div style={{ width: `${usedPercent}%` }} className="bg-gray-400 dark:bg-gray-500" title="رصيد مستخدم سابقاً"></div>
                <div style={{ width: `${currentPercent}%` }} className={`transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : 'bg-indigo-500 relative overflow-hidden'}`} title="الطلب الحالي">
                     <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>
                </div>
            </div>
            <div className="mt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    الطلب الحالي: {current.toFixed(2)} ساعة
                </span>
                <span className="text-[10px] text-gray-400">إجمالي الحد الشهري: {total} ساعات</span>
            </div>
        </div>
    );
};

const DynamicField: React.FC<{ field: FormField; value: any; onChange: (id: string, value: any) => void; }> = ({ field, value, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        onChange(field.id, e.target.value);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) onChange(field.id, e.target.files[0]);
    };

    if (field.id === 'reason') {
        return (
             <div className="relative">
                <div className="absolute top-3 right-3 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <textarea 
                    id={field.id} 
                    value={value || ''} 
                    onChange={handleChange} 
                    required={field.required} 
                    rows={4} 
                    className="block w-full pr-10 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="اكتب سبب الاستئذان بالتفصيل..."
                />
             </div>
        );
    }

    switch (field.type) {
        case FieldType.TEXT:
        case FieldType.NUMBER:
        case FieldType.DATE:
        case FieldType.TIME:
            return <input type={field.type} id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10" />;
        case FieldType.TEXTAREA:
             return <textarea id={field.id} value={value || ''} onChange={handleChange} required={field.required} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />;
        case FieldType.SELECT:
            return (
                <select id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10">
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
    const [permissionUsage, setPermissionUsage] = useState<number>(0);

    // Clock States (Start 8:00, End 10:00 default)
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
                
                if (isPermissionService && user) {
                    const now = new Date();
                    const used = await getMonthlyPermissionUsage(user.uid, now.getMonth(), now.getFullYear());
                    setPermissionUsage(used || 0);
                    setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
                }
            } catch (err) {
                setError("لا يمكن تحميل تعريف الخدمة.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId, user, isPermissionService]);

    // Validate times
    const validateTimeInput = (h: number, m: number, isStart: boolean) => {
        // Enforce work hours 8 - 16
        if (h < 8) { h = 8; m = 0; }
        if (h > 16 || (h === 16 && m > 0)) { h = 16; m = 0; }
        
        // Logical constraint (Start < End)
        const total = h * 60 + m;
        const compareTotal = isStart ? (endHour * 60 + endMinute) : (startHour * 60 + startMinute);

        if (isStart && total >= compareTotal) {
            // Push end forward if possible
            // Or just return previous values? Better to clamp.
            // Let's just update state, the Circular Picker has logic to prevent crossover dragging, 
            // but manual input needs checking.
            // Allow update, but handleSubmit will validate.
        }
        
        if (isStart) {
            setStartHour(h); setStartMinute(m);
        } else {
            setEndHour(h); setEndMinute(m);
        }
    };

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

    const currentDurationHours = useMemo(() => {
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        return Math.max(0, (end - start) / 60);
    }, [startHour, startMinute, endHour, endMinute]);

    const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
        e.preventDefault();
        if (!service || !user || !employeeData) {
            setError("بيانات المستخدم أو الخدمة غير متوفرة.");
            return;
        }
        
        let finalPayload = { ...formData };
        if (isPermissionService) {
            const startTotal = startHour * 60 + startMinute;
            const endTotal = endHour * 60 + endMinute;
            
            if (endTotal <= startTotal) {
                setError("وقت النهاية يجب أن يكون بعد وقت البداية.");
                return;
            }

            const durationMinutes = endTotal - startTotal;
            const durationHours = durationMinutes / 60;

            let type = "خروج أثناء الدوام";
            if (startHour === 8 && startMinute === 0) type = "تأخر عن العمل";

            if ((permissionUsage + durationHours) > 8) {
                setError("عذراً، الرصيد المتاح لا يكفي لهذا الطلب.");
                return;
            }
            finalPayload.type = type;
            finalPayload.durationMinutes = durationMinutes;
            finalPayload.durationHours = durationHours;
            finalPayload.permissionType = type; // Duplicate for safety
        }

        setSubmitting(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            for (const field of service.fields) {
                if (field.type === FieldType.FILE && finalPayload[field.id]) {
                    const file = finalPayload[field.id] as File;
                    const fileUrl = await uploadFile(file); 
                    payload[field.id] = fileUrl;
                } else {
                    payload[field.id] = finalPayload[field.id];
                }
            }
            // Add extra fields
            if (isPermissionService) {
                payload.permissionType = finalPayload.type;
                payload.durationMinutes = finalPayload.durationMinutes;
                payload.startTime = finalPayload.startTime;
                payload.endTime = finalPayload.endTime;
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

    return (
        <div>
            <Notification message={error} type="error" onClose={() => setError('')} />
            
            <div className="flex justify-between items-end mb-6">
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">{service.title}</h1>
                     <p className="text-gray-500 dark:text-gray-400 text-sm">أدخل تفاصيل الطلب أدناه.</p>
                </div>
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
                {/* 1. General Fields (Date mostly) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {service.fields.map(field => {
                            if (isPermissionService && (['startTime', 'endTime', 'reason'].includes(field.id) || field.type === FieldType.TIME)) return null;
                            return (
                                <div key={field.id}>
                                    <label htmlFor={field.id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{field.label}</label>
                                    <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Time Selection (Permissions Only) */}
                {isPermissionService && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Right: Circular Picker */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
                            <h3 className="text-gray-800 dark:text-white font-bold mb-4">تحديد الوقت بالمؤشر</h3>
                            <CircularTimePicker 
                                startHour={startHour}
                                startMinute={startMinute}
                                endHour={endHour}
                                endMinute={endMinute}
                                onChangeStart={(h, m) => { setStartHour(h); setStartMinute(m); }}
                                onChangeEnd={(h, m) => { setEndHour(h); setEndMinute(m); }}
                            />
                            <p className="text-xs text-gray-400 mt-4 text-center">قم بتحريك المقابض الخضراء (البداية) والحمراء (النهاية) لتعديل الوقت</p>
                        </div>

                        {/* Left: Inputs & Stats */}
                        <div className="space-y-6">
                            {/* Manual Inputs */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-gray-800 dark:text-white font-bold mb-4">أو أدخل الوقت يدوياً</h3>
                                <div className="flex gap-4">
                                    <TimeInput 
                                        label="وقت البداية (من)" 
                                        hour={startHour} minute={startMinute} 
                                        onHourChange={(h) => validateTimeInput(h, startMinute, true)}
                                        onMinuteChange={(m) => validateTimeInput(startHour, m, true)}
                                        colorClass="border-green-100 dark:border-green-900"
                                    />
                                    <TimeInput 
                                        label="وقت النهاية (إلى)" 
                                        hour={endHour} minute={endMinute} 
                                        onHourChange={(h) => validateTimeInput(h, endMinute, false)}
                                        onMinuteChange={(m) => validateTimeInput(endHour, m, false)}
                                        colorClass="border-red-100 dark:border-red-900"
                                    />
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <UsageProgressBar 
                                used={permissionUsage} 
                                current={currentDurationHours} 
                                total={8} 
                            />
                        </div>
                    </div>
                )}

                {/* 3. Reason & Attachments */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                     {service.fields.map(field => {
                            if (field.id !== 'reason') return null;
                            return (
                                <div key={field.id}>
                                    <label htmlFor={field.id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{field.label}</label>
                                    <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                                </div>
                            );
                    })}
                     {service.fields.map(field => {
                            if (field.type !== FieldType.FILE) return null;
                            return (
                                <div key={field.id} className="mt-4">
                                    <label htmlFor={field.id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{field.label}</label>
                                    <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                                </div>
                            );
                    })}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
                        إلغاء
                    </button>
                    <button 
                        type="button" 
                        onClick={(e) => handleSubmit(e as any, true)} 
                        disabled={submitting}
                        className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                    >
                        حفظ كمسودة
                    </button>
                    <button type="submit" disabled={submitting} className="px-8 py-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:-translate-y-1 transition-all font-bold disabled:bg-indigo-400">
                        {submitting ? 'جاري الإرسال...' : 'تقديم الطلب'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RequestForm;