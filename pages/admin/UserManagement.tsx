import React, { useState, useEffect } from 'react';
import { getAllEmployees, updateEmployeeAdminData } from '../../services/firebaseService';
import { Employee, SystemRole } from '../../types';
import Spinner from '../../components/Spinner';
import Notification from '../../components/Notification';

const UserManagement: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<Employee | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await getAllEmployees();
            setEmployees(data);
        } catch (err) {
            console.error(err);
            setError('فشل تحميل بيانات الموظفين.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (employee: Employee) => {
        setEditingUser({ ...employee });
    };

    const handleSave = async () => {
        if (!editingUser) return;
        setLoading(true);
        try {
            await updateEmployeeAdminData(editingUser.uid, {
                systemRole: editingUser.systemRole,
                reportsTo: editingUser.reportsTo,
                balances: editingUser.balances
            });
            setSuccess(`تم تحديث بيانات الموظف ${editingUser.name} بنجاح.`);
            setEditingUser(null);
            fetchEmployees();
        } catch (err) {
            console.error(err);
            setError('فشل حفظ التعديلات.');
        } finally {
            setLoading(false);
        }
    };

    const handleBalanceChange = (key: keyof Employee['balances'], value: string) => {
        if (!editingUser) return;
        setEditingUser({
            ...editingUser,
            balances: {
                ...editingUser.balances,
                [key]: Number(value)
            }
        });
    };

    const getManagerName = (managerId: string | null) => {
        if (!managerId) return '-';
        const manager = employees.find(e => e.uid === managerId);
        return manager ? manager.name : 'غير معروف';
    };

    if (loading && !employees.length) return <div className="flex justify-center h-64 items-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <Notification message={error} type="error" onClose={() => setError('')} />
            <Notification message={success} type="success" onClose={() => setSuccess('')} />

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة الموظفين</h1>
                <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{employees.length} موظف</span>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الموظف</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">القسم / الوظيفة</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الدور (الصلاحية)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المدير المباشر</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">رصيد الإجازات</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {employees.map((emp) => (
                                <tr key={emp.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</div>
                                        <div className="text-xs text-gray-500">{emp.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{emp.jobTitle}</div>
                                        <div className="text-xs text-gray-500">{emp.department}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {emp.systemRole}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {getManagerName(emp.reportsTo)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <span>سنوي: {emp.balances?.annual || 0}</span>
                                            <span>مرضي: {emp.balances?.sick || 0}</span>
                                            <span>عارضة: {emp.balances?.casual || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEditClick(emp)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">
                                            تعديل
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2">
                            تعديل بيانات: {editingUser.name}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الدور الوظيفي (الصلاحيات)</label>
                                <select 
                                    value={editingUser.systemRole} 
                                    onChange={(e) => setEditingUser({ ...editingUser, systemRole: e.target.value as SystemRole })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    {Object.values(SystemRole).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Manager Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المدير المباشر</label>
                                <select 
                                    value={editingUser.reportsTo || ''} 
                                    onChange={(e) => setEditingUser({ ...editingUser, reportsTo: e.target.value || null })}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">-- لا يوجد --</option>
                                    {employees
                                        .filter(e => e.uid !== editingUser.uid) // Can't report to self
                                        .map(manager => (
                                        <option key={manager.uid} value={manager.uid}>{manager.name} ({manager.jobTitle})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Balances */}
                            <div className="col-span-1 md:col-span-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">أرصدة الإجازات</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">سنوية</label>
                                        <input 
                                            type="number" 
                                            value={editingUser.balances?.annual || 0} 
                                            onChange={(e) => handleBalanceChange('annual', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">مرضية</label>
                                        <input 
                                            type="number" 
                                            value={editingUser.balances?.sick || 0} 
                                            onChange={(e) => handleBalanceChange('sick', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">عارضة</label>
                                        <input 
                                            type="number" 
                                            value={editingUser.balances?.casual || 0} 
                                            onChange={(e) => handleBalanceChange('casual', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 space-x-reverse pt-4">
                            <button 
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400"
                            >
                                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;