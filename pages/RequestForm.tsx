import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getServiceDefinition, createRequest, updateRequest, getMonthlyPermissionUsage, getRequestDetails } from '../services/firebaseService';
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
                        className="w-12 h-10 text-center text-xl font-bold bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                        className="w-12 h-10 text-center text-xl font-bold bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-teal-500 focus:outline-none"
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

    // WORK HOURS CONSTANTS: 8:00 AM to 4:00 PM (16:00)
    // We map 8:00 -> Angle 240 deg (8 on clock)
    // We map 16:00 -> Angle 120 deg (4 on clock)
    // Visual Clock: 0 deg = 12 o'clock (Top), 90 = 3, 180 = 6, 270 = 9.
    
    // Normalize any hour/minute to absolute minutes from 0:00
    const toTotalMinutes = (h: number, m: number) => h * 60 + m;

    // Convert Time to Angle (Degrees 0-360, 0 at top)
    const timeToAngle = (h: number, m: number) => {
        // Standard clock position: (h % 12) * 30 + m * 0.5
        // 8:00 => 8 * 30 = 240 deg
        // 16:00 (4pm) => 4 * 30 = 120 deg
        let hour12 = h % 12; 
        if (hour12 === 0 && h === 12) hour12 = 12; // if needed
        return (hour12 * 30) + (m * 0.5);
    };

    // Convert Angle to Time (Restricted to 8:00 - 16:00)
    const angleToTime = (angle: number) => {
        // angle is 0 at top, clockwise
        // Valid range on clock face for 8am-4pm is:
        // 240 deg (8am) -> 360 deg (12pm) -> 0 deg -> 120 deg (4pm)
        
        // Normalize angle for easier logic:
        // Let's shift so 8am (240) is 0.
        // 240 -> 0 relative
        // 360 -> 120 relative
        // 120 -> 240 relative
        
        let relativeAngle = 0;
        if (angle >= 240) {
            relativeAngle = angle - 240;
        } else if (angle <= 120) {
            relativeAngle = angle + 120;
        } else {
            // Dead zone (120 to 240) - Bottom of clock
            // Snap to nearest
            const distTo4pm = Math.abs(angle - 120);
            const distTo8am = Math.abs(angle - 240);
            if (distTo4pm < distTo8am) return { h: 16, m: 0 };
            else return { h: 8, m: 0 };
        }

        // 1 degree = 2 minutes (since 360 deg = 12 hours = 720 min, so 1 deg = 2 min)
        const minutesAdded = relativeAngle * 2;
        const totalMinutes = 480 + minutesAdded; // 480 is 8:00 in minutes

        let h = Math.floor(totalMinutes / 60);
        let m = Math.floor(totalMinutes % 60);
        
        // Snap to 5 min
        m = Math.round(m / 5) * 5;
        if (m === 60) { m = 0; h += 1; }
        
        // Hard Clamp
        if (h < 8) return { h: 8, m: 0 };
        if (h > 16 || (h === 16 && m > 0)) return { h: 16, m: 0 };

        return { h, m };
    };

    const handleMove = (e: MouseEvent | TouchEvent, isStart: boolean) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        
        // Calculate vector from center
        const x = clientX - rect.left - CX;
        const y = clientY - rect.top - CY;

        // Atan2 gives angle from X axis (3 o'clock). We want from Y axis (12 o'clock)
        // Standard Atan2: 0 at 3 o'clock, +PI at 9.
        // Shift to Clock: Angle = Atan2(y, x) + 90deg
        let angleDeg = (Math.atan2(y, x) * 180 / Math.PI) + 90;
        if (angleDeg < 0) angleDeg += 360;

        const newTime = angleToTime(angleDeg);

        const currentStartMins = toTotalMinutes(startHour, startMinute);
        const currentEndMins = toTotalMinutes(endHour, endMinute);
        const newMins = toTotalMinutes(newTime.h, newTime.m);

        if (isStart) {
            // Start cannot be after End
            if (newMins < currentEndMins) onChangeStart(newTime.h, newTime.m);
        } else {
            // End cannot be before Start
            if (newMins > currentStartMins) onChangeEnd(newTime.h, newTime.m);
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
    
    // Calculate Large Arc Flag
    // We are drawing from Start to End clockwise.
    // If we cross 0 (12 o'clock), the math gets tricky.
    // Length of arc in degrees:
    let arcLength = endAngle - startAngle;
    if (arcLength < 0) arcLength += 360;
    
    const largeArc = arcLength > 180 ? 1 : 0;
    const p1 = polarToCartesian(startAngle);
    const p2 = polarToCartesian(endAngle);
    
    const arcPath = `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;

    // Ticks
    const numbers = [8, 9, 10, 11, 12, 1, 2, 3, 4];

    return (
        <div className="flex items-center justify-center select-none scale-90 sm:scale-100">
            <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="cursor-pointer">
                {/* Background Track (Only 8 to 4) */}
                {/* 8am is 240, 4pm is 120. Total 240 deg arc */}
                <path d={`M ${polarToCartesian(240).x} ${polarToCartesian(240).y} A ${R} ${R} 0 1 1 ${polarToCartesian(120).x} ${polarToCartesian(120).y}`} 
                      fill="none" stroke="#f3f4f6" strokeWidth="24" strokeLinecap="round" className="dark:stroke-gray-700" />

                {/* Active Arc */}
                <path d={arcPath} fill="none" stroke="#0d9488" strokeWidth="24" strokeLinecap="round" className="opacity-60 drop-shadow-sm" />

                {/* Ticks/Numbers */}
                {numbers.map(num => {
                    let h24 = num;
                    if (num >= 1 && num <= 4) h24 += 12;
                    const ang = timeToAngle(h24, 0);
                    const pos = polarToCartesian(ang, R - 40);
                    return <text key={num} x={pos.x} y={pos.y} dy="5" textAnchor="middle" className="text-xs font-bold fill-gray-400 pointer-events-none">{num}</text>;
                })}

                {/* Handles */}
                <g transform={`translate(${p1.x}, ${p1.y})`} onMouseDown={() => setIsDraggingStart(true)} onTouchStart={() => setIsDraggingStart(true)} className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10">
                    <circle r="16" fill="white" className="drop-shadow-md" />
                    <circle r="10" fill="#14b8a6" /> {/* Teal-500 */}
                    <text dy="4" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">من</text>
                </g>
                <g transform={`translate(${p2.x}, ${p2.y})`} onMouseDown={() => setIsDraggingEnd(true)} onTouchStart={() => setIsDraggingEnd(true)} className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10">
                    <circle r="16" fill="white" className="drop-shadow-md" />
                    <circle r="10" fill="#ef4444" /> {/* Red-500 */}
                    <text dy="4" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">إلى</text>
                </g>

                {/* Center Text */}
                <text x={CX} y={CY - 10} textAnchor="middle" className="text-sm fill-gray-400 dark:fill-gray-500 font-medium">المدة</text>
                <text x={CX} y={CY + 15} textAnchor="middle" className="text-2xl fill-teal-700 dark:fill-teal-400 font-bold">
                    {Math.floor((endHour * 60 + endMinute - (startHour * 60 + startMinute))/60)}:{(endHour * 60 + endMinute - (startHour * 60 + startMinute))%60 || '00'}
                </text>
            </svg>
        </div>
    );
};

const UsageProgressBar: React.FC<{ used: number; current: number; total: number }> = ({ used, current, total }) => {
    // Logic:
    // Bar 1 (Gray): Used previously.
    // Bar 2 (Teal): Current Request.
    // If Used + Current > Total => Bar 2 becomes Red for the overflow part.
    
    const totalRequest = used + current;
    const isOverLimit = totalRequest > total;
    
    const usedPercent = Math.min((used / total) * 100, 100);
    const currentPercent = Math.min((current / total) * 100, 100 - usedPercent); // Fit within remaining if possible for display
    
    // If over limit, we visually indicate full bar, but color changes
    
    return (
        <div className={`p-5 rounded-2xl border ${isOverLimit ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'} shadow-sm`}>
            <div className="flex justify-between items-end mb-3">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">ملخص الاستهلاك الشهري</span>
                <span className={`text-sm font-bold ${isOverLimit ? 'text-red-600' : 'text-teal-600'}`}>
                    {totalRequest.toFixed(2)} / {total} ساعة
                </span>
            </div>
            
            <div className="h-6 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex relative">
                {/* Background Grid Lines (Optional) */}
                <div className="absolute inset-0 flex">
                    {[1,2,3,4,5,6,7].map(i => (
                        <div key={i} className="flex-1 border-r border-white/20 h-full"></div>
                    ))}
                </div>

                {/* Used Segment */}
                <div style={{ width: `${usedPercent}%` }} className="bg-slate-400 dark:bg-slate-500 flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500">
                    {usedPercent > 10 && `${used.toFixed(1)}`}
                </div>
                
                {/* Current Request Segment */}
                <div 
                    style={{ width: isOverLimit ? `${100 - usedPercent}%` : `${currentPercent}%` }} 
                    className={`${isOverLimit ? 'bg-red-500' : 'bg-teal-500'} flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500 relative overflow-hidden`}
                >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>
                    {current > 0.1 && `${current.toFixed(1)}`}
                </div>
            </div>

            <div className="flex justify-between mt-3 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-400 block"></span>
                    <span className="text-gray-500">مستنفذ ({used.toFixed(2)})</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full block ${isOverLimit ? 'bg-red-500' : 'bg-teal-500'}`}></span>
                    <span className={isOverLimit ? 'text-red-500 font-bold' : 'text-teal-600'}>الطلب الحالي ({current.toFixed(2)})</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-100 border border-gray-300 block"></span>
                    <span className="text-gray-400">متبقي ({Math.max(0, total - totalRequest).toFixed(2)})</span>
                </div>
            </div>
            
            {isOverLimit && (
                <p className="text-xs text-red-500 mt-2 font-bold text-center animate-pulse">
                    ⚠️ تنبيه: هذا الطلب يتجاوز رصيدك الشهري المتاح!
                </p>
            )}
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
                    className="block w-full pr-10 rounded-xl border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-base dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
            return <input type={field.type} id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10" />;
        case FieldType.TEXTAREA:
             return <textarea id={field.id} value={value || ''} onChange={handleChange} required={field.required} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />;
        case FieldType.SELECT:
            return (
                <select id={field.id} value={value || ''} onChange={handleChange} required={field.required} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white h-10">
                    <option value="">اختر...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        case FieldType.FILE:
            return <input type="file" id={field.id} onChange={handleFileChange} required={field.required} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:text-gray-400 dark:file:bg-teal-900 dark:file:text-teal-300 dark:hover:file:bg-teal-800"/>;
        default:
            return null;
    }
};

const RequestForm: React.FC = () => {
    const { serviceId } = useParams<{ serviceId: string }>();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get('draftId'); // Check if editing a draft
    
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
        const initForm = async () => {
            setLoading(true);
            try {
                // 1. Fetch Service Definition
                const serviceDef = await getServiceDefinition(serviceId);
                setService(serviceDef);
                
                if (user) {
                    // Removed the block that prevents multiple pending requests
                    // to facilitate testing and concurrent requests.

                    // 3. Load Draft Data (if draftId present)
                    if (draftId) {
                        const existingReq = await getRequestDetails(draftId);
                        if (existingReq.employeeId !== user.uid) throw new Error("Unauthorized");
                        setFormData(existingReq.payload);
                        
                        // If it's permission, load time
                        if (isPermissionService && existingReq.payload.startTime && existingReq.payload.endTime) {
                            const [sh, sm] = existingReq.payload.startTime.split(':').map(Number);
                            const [eh, em] = existingReq.payload.endTime.split(':').map(Number);
                            setStartHour(sh); setStartMinute(sm);
                            setEndHour(eh); setEndMinute(em);
                        }
                    } else if (isPermissionService) {
                        // Defaults for new request
                        setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
                    }

                    // 4. Fetch Usage (if permission)
                    if (isPermissionService) {
                        const now = new Date();
                        const used = await getMonthlyPermissionUsage(user.uid, now.getMonth(), now.getFullYear());
                        setPermissionUsage(used || 0);
                    }
                }
            } catch (err) {
                console.error(err);
                setError("فشل تحميل البيانات أو المسودة.");
            }
            setLoading(false);
        };
        initForm();
    }, [serviceId, user, isPermissionService, draftId]);

    // Validate times
    const validateTimeInput = (h: number, m: number, isStart: boolean) => {
        // Enforce work hours 8 - 16
        if (h < 8) { h = 8; m = 0; }
        if (h > 16 || (h === 16 && m > 0)) { h = 16; m = 0; }
        
        if (isStart) {
            setStartHour(h); setStartMinute(m);
        } else {
            setEndHour(h); setEndMinute(m);
        }
    };

    // removed sync useEffect to avoid race conditions - using calculate on submit instead

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

            if (!isDraft && (permissionUsage + durationHours) > 8) {
                setError("عذراً، الرصيد المتاح لا يكفي لهذا الطلب.");
                return;
            }
            
            // Format times strictly here to ensure payload is correct
            const formattedStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
            const formattedEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

            finalPayload.type = type;
            finalPayload.durationMinutes = durationMinutes;
            finalPayload.durationHours = durationHours;
            finalPayload.permissionType = type; 
            finalPayload.startTime = formattedStart;
            finalPayload.endTime = formattedEnd;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            for (const field of service.fields) {
                if (field.type === FieldType.FILE && finalPayload[field.id] instanceof File) {
                    const file = finalPayload[field.id] as File;
                    const fileUrl = await uploadFile(file); 
                    payload[field.id] = fileUrl;
                } else {
                    payload[field.id] = finalPayload[field.id];
                }
            }
            // Add extra fields explicitly
            if (isPermissionService) {
                payload.permissionType = finalPayload.type;
                payload.durationMinutes = finalPayload.durationMinutes;
                payload.startTime = finalPayload.startTime;
                payload.endTime = finalPayload.endTime;
                payload.date = finalPayload.date; // Ensure date is there
                payload.reason = finalPayload.reason; // Ensure reason is there
            }
            
            if (draftId) {
                // Update Existing Request
                await updateRequest(draftId, user.uid, service, payload, isDraft);
            } else {
                // Create New Request
                await createRequest(user.uid, employeeData.name, service, payload, isDraft);
            }
            
            navigate('/dashboard');

        } catch (err) {
            setError("فشل حفظ الطلب. يرجى المحاولة مرة أخرى.");
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
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
                        {draftId ? `تعديل: ${service.title}` : service.title}
                     </h1>
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
                                        colorClass="border-teal-100 dark:border-teal-900"
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
                        {draftId ? 'تحديث المسودة' : 'حفظ كمسودة'}
                    </button>
                    <button type="submit" disabled={submitting} className="px-8 py-3 rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-200 dark:shadow-none hover:bg-teal-700 hover:-translate-y-1 transition-all font-bold disabled:bg-teal-400">
                        {submitting ? 'جاري الإرسال...' : (draftId ? 'تعديل وإرسال الطلب' : 'تقديم الطلب')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RequestForm;