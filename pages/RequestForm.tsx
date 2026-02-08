import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest, getMonthlyPermissionUsage } from '../services/firebaseService';
import { ServiceDefinition, FieldType, FormField } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import Notification from '../components/Notification';
import { uploadFile } from '../services/gasService';

// --- Circular Time Picker Component ---

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

    // Constants for the clock
    const CX = 128; // Center X
    const CY = 128; // Center Y
    const R = 100;  // Radius
    const PADDING = 40; // Padding for container
    const SIZE = (R + PADDING) * 2;

    // Work hours constraints (8:00 to 16:00)
    // We map 12-hour clock face to angles. 
    // 12 is -90deg (0rad).
    // 8 AM is 240deg (from top 12).
    // 4 PM (16:00) is 120deg (from top 12).
    
    // Helper: Convert time to angle (degrees, 0 at top 12)
    const timeToDegrees = (h: number, m: number) => {
        // Convert to 12h format for visual position
        let visualH = h % 12; 
        if (visualH === 0 && h === 12) visualH = 12; // Handle 12 PM
        
        const totalMinutes = visualH * 60 + m;
        // 12 hours = 720 minutes = 360 degrees
        // angle = (minutes / 720) * 360
        return (totalMinutes / 720) * 360;
    };

    // Helper: Convert angle to time (clamped to work hours 8-16)
    const angleToTime = (angle: number) => {
        // angle is 0-360 starting from 12 o'clock clockwise
        let normalizedAngle = angle % 360;
        if (normalizedAngle < 0) normalizedAngle += 360;

        // Visual logic:
        // 8 AM is at 240 deg.
        // 12 PM is at 0/360 deg.
        // 4 PM is at 120 deg.
        
        // We need to map the angle to linear minutes from 8:00 (480min) to 16:00 (960min)
        // 8:00 (240deg) -> ... -> 12:00 (0deg) -> ... -> 16:00 (120deg)
        
        let minutesFrom12 = (normalizedAngle / 360) * 720; // 0 to 720
        
        // Interpret the time based on sectors
        let h = Math.floor(minutesFrom12 / 60);
        let m = Math.floor(minutesFrom12 % 60);
        
        // Round m to nearest 5 for easier selection
        m = Math.round(m / 5) * 5;
        if (m === 60) { m = 0; h += 1; }

        // Logic to determine if it's AM or PM and clamp
        let finalH = h;
        
        // Sector 8, 9, 10, 11 (Angles roughly 240 - 360) -> AM
        if (normalizedAngle >= 230) {
            if (h === 0) finalH = 12; // Should not happen with >= 230
            // No adjustment needed for AM usually, but 8,9,10,11 are usually correct in visualH
            // Wait, calculate absolute hours
            // 240 deg = 8 hours. 
        } else {
            // Sector 12, 1, 2, 3, 4 (Angles 0 - 130) -> PM
            // If h is 0 (12 oclock), it's 12 PM.
            // If h is 1, 2, 3, 4, add 12 to make it 13, 14, 15, 16
             if (h === 0) finalH = 12;
             else finalH = h + 12;
        }

        // Hard Clamp
        if (finalH < 8) {
            // It might be late PM or early AM (not allowed)
            // If user drags to 6 (180deg), snap to nearest (4 PM or 8 AM)
            if (normalizedAngle > 180) return { h: 8, m: 0 };
            return { h: 16, m: 0 };
        }
        if (finalH > 16) return { h: 16, m: 0 }; // Should be covered
        if (finalH === 16 && m > 0) return { h: 16, m: 0 };

        return { h: finalH, m };
    };

    const handleMove = (e: MouseEvent | TouchEvent, isStart: boolean) => {
        if (!svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        let clientX, clientY;
        
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        const x = clientX - rect.left - CX;
        const y = clientY - rect.top - CY;

        // Calculate angle. Atan2 returns angle from X axis (3 o'clock). 
        // We need angle from Y axis (12 o'clock) clockwise.
        // Atan2: 0 is 3 oclock, PI/2 is 6, PI is 9, -PI/2 is 12.
        let angleRad = Math.atan2(y, x);
        let angleDeg = angleRad * (180 / Math.PI);
        
        // Convert standard math angle to Clock angle (0 at top, CW)
        // Math: 0 at right (3). 
        // Clock = (angleDeg + 90)
        let clockAngle = angleDeg + 90;
        if (clockAngle < 0) clockAngle += 360;

        const { h, m } = angleToTime(clockAngle);

        if (isStart) {
            // Don't allow start > end
            if (h > endHour || (h === endHour && m >= endMinute)) return;
             onChangeStart(h, m);
        } else {
            // Don't allow end < start
            if (h < startHour || (h === startHour && m <= startMinute)) return;
            onChangeEnd(h, m);
        }
    };

    useEffect(() => {
        const handleUp = () => {
            setIsDraggingStart(false);
            setIsDraggingEnd(false);
        };

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

    // Render Helpers
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
        var start = polarToCartesian(x, y, radius, endAngle);
        var end = polarToCartesian(x, y, radius, startAngle);
        // Correct arc flag
        var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        // Correction for crossing 360 boundary logic visually if needed, 
        // but here we know range is 240 -> 360 -> 120 approx. 
        // Simpler: total degrees span.
        
        let span = endAngle - startAngle;
        if (span < 0) span += 360;
        largeArcFlag = span > 180 ? "1" : "0";

        var d = [
            "M", start.x, start.y, 
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
        return d;
    };

    const startDeg = timeToDegrees(startHour, startMinute);
    const endDeg = timeToDegrees(endHour, endMinute);
    
    // Calculate arc path. Note: SVG path draws CCW or needs specific flags. 
    // Start drawing from Start Time to End Time.
    const arcPath = describeArc(CX, CY, R, startDeg, endDeg);

    // Clock numbers (8, 9, 10, 11, 12, 1, 2, 3, 4)
    const numbers = [8, 9, 10, 11, 12, 1, 2, 3, 4];

    // Helper to position handles
    const startPos = polarToCartesian(CX, CY, R, startDeg);
    const endPos = polarToCartesian(CX, CY, R, endDeg);

    return (
        <div className="flex flex-col items-center justify-center py-4 select-none">
            <svg 
                ref={svgRef}
                width={SIZE} 
                height={SIZE} 
                viewBox={`0 0 ${SIZE} ${SIZE}`} 
                className="cursor-pointer"
                onMouseDown={(e) => e.preventDefault()} // Prevent text selection
            >
                {/* Clock Face Circle */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth="20" className="dark:stroke-gray-700" />
                
                {/* Active Arc (Work Duration) */}
                <path d={arcPath} fill="none" stroke="#6366f1" strokeWidth="20" strokeLinecap="round" className="opacity-30 dark:opacity-50" />

                {/* Clock Numbers */}
                {numbers.map(num => {
                    const angle = timeToDegrees(num, 0);
                    const pos = polarToCartesian(CX, CY, R - 35, angle);
                    return (
                        <text 
                            key={num} 
                            x={pos.x} 
                            y={pos.y} 
                            dy="5" 
                            textAnchor="middle" 
                            className="text-xs font-bold fill-gray-400 dark:fill-gray-500 pointer-events-none"
                        >
                            {num}
                        </text>
                    );
                })}

                {/* Ticks for 8am and 4pm limits */}
                <circle cx={polarToCartesian(CX, CY, R, 240).x} cy={polarToCartesian(CX, CY, R, 240).y} r="4" fill="#9ca3af" />
                <circle cx={polarToCartesian(CX, CY, R, 120).x} cy={polarToCartesian(CX, CY, R, 120).y} r="4" fill="#9ca3af" />

                {/* Start Handle */}
                <g 
                    transform={`translate(${startPos.x}, ${startPos.y})`} 
                    className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                    onMouseDown={() => setIsDraggingStart(true)}
                    onTouchStart={() => setIsDraggingStart(true)}
                >
                    <circle r="16" fill="white" className="drop-shadow-lg" />
                    <circle r="10" fill="#22c55e" /> {/* Green */}
                    <text dy="4" textAnchor="middle" className="text-[10px] font-bold fill-white pointer-events-none">من</text>
                </g>

                {/* End Handle */}
                <g 
                    transform={`translate(${endPos.x}, ${endPos.y})`} 
                    className="cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                    onMouseDown={() => setIsDraggingEnd(true)}
                    onTouchStart={() => setIsDraggingEnd(true)}
                >
                    <circle r="16" fill="white" className="drop-shadow-lg" />
                    <circle r="10" fill="#ef4444" /> {/* Red */}
                    <text dy="4" textAnchor="middle" className="text-[10px] font-bold fill-white pointer-events-none">إلى</text>
                </g>
            </svg>
        </div>
    );
};

// --- Main Form Component ---

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
                    setPermissionUsage(used);
                    setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
                }
            } catch (err) {
                setError("لا يمكن تحميل تعريف الخدمة.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId, user, isPermissionService]);

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

    const currentDuration = useMemo(() => {
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        const diff = end - start;
        return diff > 0 ? diff : 0;
    }, [startHour, startMinute, endHour, endMinute]);

    const validatePermissionLogic = (data: Record<string, any>): { valid: boolean; error?: string; calculatedType?: string; durationMinutes?: number } => {
        if (!isPermissionService) return { valid: true };

        const { date } = data;
        if (!date) return { valid: false, error: "يرجى تحديد التاريخ." };

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
            return { valid: false, error: `الرصيد غير كافي. المستخدم: ${currentUsage.toFixed(2)} س. الطلب: ${durationHours.toFixed(2)} س.` };
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
                
                {service.fields.map(field => {
                    if (isPermissionService && (field.id === 'startTime' || field.id === 'endTime' || field.type === FieldType.TIME)) return null;
                    return (
                        <div key={field.id}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                            <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                        </div>
                    );
                })}

                {/* Circular Time Picker UI */}
                {isPermissionService && (
                    <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-inner">
                        <div className="flex flex-col items-center">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">تحديد وقت الإذن</h3>
                            <p className="text-xs text-gray-500 mb-6">اسحب المقابض لتحديد وقت البداية والنهاية</p>
                            
                            <CircularTimePicker 
                                startHour={startHour}
                                startMinute={startMinute}
                                endHour={endHour}
                                endMinute={endMinute}
                                onChangeStart={(h, m) => { setStartHour(h); setStartMinute(m); }}
                                onChangeEnd={(h, m) => { setEndHour(h); setEndMinute(m); }}
                            />

                            <div className="flex justify-between w-full max-w-sm mt-8 gap-4">
                                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30 flex-1">
                                    <span className="text-xs text-green-600 dark:text-green-400 font-bold block mb-1">وقت البداية</span>
                                    <span className="text-xl font-mono font-bold text-gray-800 dark:text-white">{pad(startHour)}:{pad(startMinute)}</span>
                                </div>
                                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/30 flex-1">
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block mb-1">المدة</span>
                                    <span className="text-xl font-mono font-bold text-gray-800 dark:text-white">
                                        {Math.floor(currentDuration / 60)}:{pad(currentDuration % 60)}
                                    </span>
                                </div>
                                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 flex-1">
                                    <span className="text-xs text-red-600 dark:text-red-400 font-bold block mb-1">وقت النهاية</span>
                                    <span className="text-xl font-mono font-bold text-gray-800 dark:text-white">{pad(endHour)}:{pad(endMinute)}</span>
                                </div>
                            </div>
                            
                            <div className="mt-4">
                                 <span className={`px-4 py-1 rounded-full text-xs font-bold shadow-sm ${startHour === 8 && startMinute === 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                    {startHour === 8 && startMinute === 0 ? "⚠️ تصنيف: تأخر عن العمل" : "ℹ️ تصنيف: خروج أثناء الدوام"}
                                </span>
                            </div>
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