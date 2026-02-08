import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addService } from '../../services/firebaseService';
import { FieldType, SystemRole, ApprovalStepType, FormField, ApprovalStep } from '../../types';
import Notification from '../../components/Notification';

const ServiceBuilder: React.FC = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState('📄');
    const [color, setColor] = useState('blue-500');
    const [fields, setFields] = useState<FormField[]>([]);
    const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const addField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'حقل جديد',
            type: FieldType.TEXT,
            required: true,
            options: []
        };
        setFields([...fields, newField]);
    };

    const updateField = (index: number, key: keyof FormField, value: any) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };
        setFields(newFields);
    };
    
    const updateFieldOptions = (index: number, optionsString: string) => {
        const options = optionsString.split(',').map(s => s.trim()).filter(s => s !== '');
        updateField(index, 'options', options);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const addStep = () => {
        const newStep: ApprovalStep = {
            order: approvalSteps.length + 1,
            type: ApprovalStepType.REPORTS_TO,
            roleValue: null
        };
        setApprovalSteps([...approvalSteps, newStep]);
    };

    const updateStep = (index: number, key: keyof ApprovalStep, value: any) => {
        const newSteps = [...approvalSteps];
        newSteps[index] = { ...newSteps[index], [key]: value };
        // Reset roleValue if type changes to REPORTS_TO
        if (key === 'type' && value === ApprovalStepType.REPORTS_TO) {
            newSteps[index].roleValue = null;
        }
         // Set default roleValue if type changes to SYSTEM_ROLE
        if (key === 'type' && value === ApprovalStepType.SYSTEM_ROLE) {
            newSteps[index].roleValue = SystemRole.HR_ADMIN;
        }
        setApprovalSteps(newSteps);
    };

    const removeStep = (index: number) => {
        setApprovalSteps(approvalSteps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 })));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) {
            setError('يرجى إدخال عنوان الخدمة');
            return;
        }
        if (fields.length === 0) {
            setError('يجب إضافة حقل واحد على الأقل للنموذج');
            return;
        }
        if (approvalSteps.length === 0) {
            setError('يجب إضافة خطوة موافقة واحدة على الأقل');
            return;
        }

        setLoading(true);
        try {
            await addService({
                title,
                icon,
                color,
                fields,
                approvalSteps
            });
            navigate('/new-request');
        } catch (err) {
            console.error(err);
            setError('فشل حفظ الخدمة. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
             <Notification message={error} type="error" onClose={() => setError('')} />
             
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">بناء خدمة جديدة</h1>
                <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">إلغاء</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Basic Info */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">1. بيانات الخدمة الأساسية</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">اسم الخدمة</label>
                            <input 
                                type="text" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="مثال: طلب شراء جهاز"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الأيقونة (Emoji)</label>
                            <input 
                                type="text" 
                                value={icon} 
                                onChange={e => setIcon(e.target.value)} 
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="💻"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Form Fields Builder */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">2. تصميم النموذج</h2>
                        <button type="button" onClick={addField} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300">
                            + إضافة حقل
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={index} className="flex flex-wrap md:flex-nowrap items-start gap-4 p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <div className="w-full md:w-1/3">
                                    <label className="text-xs text-gray-500">عنوان الحقل</label>
                                    <input 
                                        type="text" 
                                        value={field.label} 
                                        onChange={e => updateField(index, 'label', e.target.value)} 
                                        className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                    <input 
                                        type="text" 
                                        value={field.id}
                                        onChange={e => updateField(index, 'id', e.target.value)}
                                        className="mt-1 block w-full text-xs text-gray-400 bg-transparent border-none p-0 focus:ring-0"
                                        placeholder="المعرف الفريد (إنجليزي)"
                                    />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <label className="text-xs text-gray-500">نوع الحقل</label>
                                    <select 
                                        value={field.type} 
                                        onChange={e => updateField(index, 'type', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        {Object.values(FieldType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="w-full md:w-1/3">
                                    {field.type === FieldType.SELECT && (
                                        <div>
                                            <label className="text-xs text-gray-500">الخيارات (افصل بفاصلة)</label>
                                            <input 
                                                type="text" 
                                                value={field.options?.join(', ')} 
                                                onChange={e => updateFieldOptions(index, e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                placeholder="أحمر, أخضر, أزرق"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center pt-6">
                                    <input 
                                        type="checkbox" 
                                        checked={field.required} 
                                        onChange={e => updateField(index, 'required', e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="ms-2 text-sm text-gray-600 dark:text-gray-400">إلزامي</span>
                                </div>
                                <button type="button" onClick={() => removeField(index)} className="text-red-500 hover:text-red-700 pt-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Workflow Builder */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">3. مسار الموافقات</h2>
                        <button type="button" onClick={addStep} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300">
                            + إضافة خطوة
                        </button>
                    </div>

                    <div className="space-y-4">
                         {approvalSteps.map((step, index) => (
                             <div key={index} className="flex items-center gap-4 p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                 <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full font-bold">
                                     {index + 1}
                                 </span>
                                 <div className="flex-1">
                                    <label className="text-xs text-gray-500">نوع المسؤول</label>
                                    <select 
                                        value={step.type} 
                                        onChange={e => updateStep(index, 'type', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value={ApprovalStepType.REPORTS_TO}>المدير المباشر</option>
                                        <option value={ApprovalStepType.SYSTEM_ROLE}>دور وظيفي محدد</option>
                                    </select>
                                 </div>
                                 <div className="flex-1">
                                     {step.type === ApprovalStepType.SYSTEM_ROLE && (
                                         <div>
                                            <label className="text-xs text-gray-500">اختر الدور</label>
                                            <select 
                                                value={step.roleValue || ''} 
                                                onChange={e => updateStep(index, 'roleValue', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            >
                                                {Object.values(SystemRole).map(role => <option key={role} value={role}>{role}</option>)}
                                            </select>
                                         </div>
                                     )}
                                     {step.type === ApprovalStepType.REPORTS_TO && (
                                         <p className="mt-6 text-sm text-gray-500">سيتم إرسال الطلب للمدير المباشر للموظف.</p>
                                     )}
                                 </div>
                                 <button type="button" onClick={() => removeStep(index)} className="text-red-500 hover:text-red-700 pt-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                 </button>
                             </div>
                         ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 font-bold"
                    >
                        {loading ? 'جاري الحفظ...' : 'حفظ ونشر الخدمة'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ServiceBuilder;