import React from 'react';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">لوحة تحكم المسؤول</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">إدارة الموظفين والخدمات وسير العمل.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">إدارة الموظفين</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">إضافة وتعديل بيانات الموظفين وتحديد الأدوار والمدراء.</p>
                    <button className="mt-4 px-4 py-2 text-sm bg-indigo-100 text-indigo-800 rounded-md hover:bg-indigo-200">
                        الانتقال إلى إدارة الموظفين
                    </button>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">إدارة الخدمات</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">إنشاء وتعديل الخدمات المتاحة للموظفين ومسارات الموافقات الخاصة بها.</p>
                     <Link to="/admin/services/new" className="mt-4 inline-block px-4 py-2 text-sm bg-indigo-100 text-indigo-800 rounded-md hover:bg-indigo-200">
                        + إنشاء خدمة جديدة
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;