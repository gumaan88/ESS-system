import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceDefinition, createRequest } from '../services/firebaseService';
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

    useEffect(() => {
        if (!serviceId) return;
        const fetchService = async () => {
            setLoading(true);
            try {
                const serviceDef = await getServiceDefinition(serviceId);
                setService(serviceDef);
            } catch (err) {
                setError("لا يمكن تحميل تعريف الخدمة.");
            }
            setLoading(false);
        };
        fetchService();
    }, [serviceId]);

    const handleFormChange = (id: string, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!service || !user || !employeeData) {
            setError("بيانات المستخدم أو الخدمة غير متوفرة.");
            return;
        }
        
        setSubmitting(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            for (const field of service.fields) {
                if (field.type === FieldType.FILE && formData[field.id]) {
                    const file = formData[field.id] as File;
                    const fileUrl = await uploadFile(file); // Calls GAS middleware
                    payload[field.id] = fileUrl;
                } else {
                    payload[field.id] = formData[field.id];
                }
            }
            
            await createRequest(user.uid, employeeData.name, service, payload);
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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{service.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">يرجى ملء النموذج التالي لتقديم طلبك.</p>
            
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                {service.fields.map(field => (
                    <div key={field.id}>
                        <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                        <DynamicField field={field} value={formData[field.id]} onChange={handleFormChange} />
                    </div>
                ))}
                
                <div className="pt-5">
                    <div className="flex justify-end space-x-3 space-x-reverse">
                        <button type="button" onClick={() => navigate(-1)} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                            إلغاء
                        </button>
                        <button type="submit" disabled={submitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                            {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default RequestForm;