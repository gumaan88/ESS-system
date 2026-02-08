import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SystemRole } from '../types';
import { updateEmployeeRole } from '../services/firebaseService';
import Notification from '../components/Notification';

const Profile: React.FC = () => {
    const { employeeData, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleUpgradeToAdmin = async () => {
        if (!user || !employeeData) return;
        setLoading(true);
        try {
            await updateEmployeeRole(user.uid, SystemRole.HR_ADMIN);
            setMessage('تمت ترقية حسابك إلى مدير موارد بشرية (HR_ADMIN). سيتم إعادة تحميل الصفحة لتطبيق الصلاحيات.');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err) {
            console.error(err);
            setError('حدث خطأ أثناء تحديث الصلاحية.');
        } finally {
            setLoading(false);
        }
    };

    if (!employeeData) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <Notification message={message} type="success" onClose={() => setMessage('')} />
            <Notification message={error} type="error" onClose={() => setError('')} />

            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">الملف الشخصي</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">إدارة بياناتك وإعدادات الحساب.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">بيانات الموظف</h3>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                    <dl>
                        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">الاسم الكامل</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{employeeData.name}</dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">المسمى الوظيفي</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{employeeData.jobTitle}</dd>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">القسم</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{employeeData.department}</dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">البريد الإلكتروني</dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{employeeData.email}</dd>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">الصلاحية الحالية (System Role)</dt>
                            <dd className="mt-1 text-sm font-mono text-indigo-600 dark:text-indigo-400 sm:mt-0 sm:col-span-2">{employeeData.systemRole}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Developer Section - For Setup Only */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-6">
                <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">إعدادات المطور (Developer Tools)</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                    لأغراض تطوير وبناء النظام، يمكنك تغيير صلاحيتك مؤقتاً للوصول إلى لوحة التحكم وبناء الخدمات.
                </p>
                {employeeData.systemRole !== SystemRole.HR_ADMIN ? (
                    <button 
                        onClick={handleUpgradeToAdmin}
                        disabled={loading}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                    >
                        {loading ? 'جاري التحديث...' : 'ترقية الحساب إلى مسؤول (HR_ADMIN)'}
                    </button>
                ) : (
                    <p className="text-green-600 dark:text-green-400 font-bold">✓ أنت تمتلك صلاحيات المسؤول حالياً.</p>
                )}
            </div>
        </div>
    );
};

export default Profile;