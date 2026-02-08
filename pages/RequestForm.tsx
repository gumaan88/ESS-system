import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest, getMonthlyPermissionUsage } from '../services/firebaseService';
import { ServiceDefinition, FieldType, FormField } from '../types';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { uploadFile } from '../services/gasService';
import Notification from '../components/Notification';

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

    const isPermissionService = serviceId === 'permission_request';

    useEffect(() => {
        if (!serviceId) return;
        const fetchService = async () => {
            setLoading(true);
            try {
                const serviceDef = await getServiceDefinition(serviceId);
                setService(serviceDef);
                
                // If Permission Service, fetch usage
                if (serviceDef.id === 'permission_request' && user) {
                    const now = new Date();
                    const used = await getMonthlyPermissionUsage(user.uid, now.getMonth(), now.getFullYear());
                    setPermissionUsage(used);
                }
            } catch (err) {
                setError("لا يمكن تحميل تعريف الخدمة.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId, user]);

    const handleFormChange = (id: string, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const validatePermissionLogic = (data: Record<string, any>): { valid: boolean; error?: string; calculatedType?: string; durationMinutes?: number } => {
        if (!isPermissionService) return { valid: true };

        const { startTime, endTime, date } = data;
        if (!startTime || !endTime || !date) return { valid: true }; // Let HTML5 validation handle missing fields

        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);
        
        if (end <= start) {
            return { valid: false, error: "وقت النهاية يجب أن يكون بعد وقت البداية." };
        }

        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        const durationHours = durationMinutes / 60;

        // Check 8 AM rule
        let type = "خروج أثناء الدوام";
        // Simple check: if start time is 08:00 (allowing small buffer if needed, but strict here)
        if (startTime === "08:00") {
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
        
        // Custom Validation for Permissions
        let finalPayload = { ...formData };
        if (isPermissionService) {
            const validation = validatePermissionLogic(formData);
            if (!validation.valid) {
                setError(validation.error || "خطأ في التحقق");
                return;
            }
            finalPayload.type = validation.calculatedType; // Auto-calculated
            finalPayload.durationMinutes = validation.durationMinutes;
            finalPayload.durationHours = (validation.durationMinutes || 0) / 60;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            for (const field of service.fields) {
                // If permission, we might have injected fields or calculated ones, but we map standard ones first
                if (field.type === FieldType.FILE && finalPayload[field.id]) {
                    const file = finalPayload[field.id] as File;
                    const fileUrl = await uploadFile(file); 
                    payload[field.id] = fileUrl;
                } else {
                    payload[field.id] = finalPayload[field.id];
                }
            }
            
            // Merge calculated extras
            if (isPermissionService) {
                payload.permissionType = finalPayload.type;
                payload.durationMinutes = finalPayload.durationMinutes;
            }
            
            await createRequest(user.uid, employeeData.name, service, payload, isDraft);
            navigate(isDraft ? '/dashboard' : '/dashboard'); // Or to inbox/drafts

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
            
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{service.title}</h1>
                     <p className="text-gray-500 dark:text-gray-400">يرجى ملء النموذج التالي لتقديم طلبك.</p>
                </div>
                {isPermissionService && permissionUsage !== null && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">رصيد الأذونات المستخدم (شهري)</span>
                        <span className={`text-lg font-bold ${permissionUsage >= 8 ? 'text-red-600' : 'text-indigo-600'}`}>
                            {permissionUsage.toFixed(2)} / 8.00 ساعات
                        </span>
                    </div>
                )}
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                {service.fields.map(field => (
                    <div key={field.id}>
                        <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                        <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                    </div>
                ))}
                
                {/* Preview Auto-Calculated Type for Permission */}
                {isPermissionService && formData.startTime && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            نوع الإذن المحتسب: <span className="font-bold">{formData.startTime === "08:00" ? "تأخر عن العمل" : "خروج أثناء الدوام"}</span>
                        </p>
                    </div>
                )}

                <div className="pt-5 border-t dark:border-gray-700 mt-6">
                    <div className="flex justify-end space-x-3 space-x-reverse">
                        <button type="button" onClick={() => navigate(-1)} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                            إلغاء
                        </button>
                        
                        {/* Draft Button */}
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