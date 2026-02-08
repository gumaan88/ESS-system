import React, { useState, useEffect } from 'react';
import { getAllEmployees, updateEmployeeAdminData, registerNewEmployee } from '../../services/firebaseService';
import { Employee, SystemRole } from '../../types';
import Spinner from '../../components/Spinner';
import Notification from '../../components/Notification';

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // دالة للتحقق من صلاحية المسؤول
    function isAdmin() {
      return get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.systemRole == 'HR_ADMIN';
    }
    
    // قواعد الموظفين
    match /employees/{userId} {
      // يسمح بالقراءة للموظف نفسه أو المسؤول
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      // يسمح بالكتابة (التعديل/الإنشاء) للمسؤول فقط (أو يمكن تخصيصها)
      allow write: if isAdmin();
    }
    
    // قواعد الطلبات
    match /requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // قواعد الخدمات
    match /services/{serviceId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}`;

const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const copyToClipboard = () => {
        navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
        alert("تم نسخ القواعد إلى الحافظة");
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">إعداد قواعد الأمان (Firestore Rules)</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    <p className="mb-2">يبدو أنك تواجه مشكلة في الصلاحيات. لكي يعمل النظام بشكل صحيح، يجب نسخ القواعد التالية ووضعها في تبويب <strong>"Rules"</strong> داخل قسم <strong>Firestore Database</strong> في لوحة تحكم Firebase.</p>
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto text-xs font-mono border border-gray-700" dir="ltr">
                    <pre>{FIRESTORE_RULES_SNIPPET}</pre>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300">إغلاق</button>
                    <button onClick={copyToClipboard} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">نسخ القواعد</button>
                </div>
            </div>
        </div>
    );
};

const UserManagement: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<Employee | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showRulesModal, setShowRulesModal] = useState(false);

    // New Employee State
    const [newEmployee, setNewEmployee] = useState({
        name: '',
        email: '',
        password: '',
        jobTitle: '',
        department: '',
        systemRole: SystemRole.EMPLOYEE,
        reportsTo: '',
        balances: {
            annual: 21,
            sick: 10,
            casual: 5
        }
    });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getAllEmployees();
            setEmployees(data);
        } catch (err: any) {
            console.error("Failed to fetch employees:", err);
            // Enhanced error handling for permissions
            if (err.code === 'permission-denied') {
                setError('PERMISSION_DENIED');
            } else if (err.code === 'failed-precondition') {
                 setError('الاستعلام يتطلب فهرس (Index) في Firestore. راجع "Console Log" للحصول على رابط إنشاء الفهرس.');
            } else {
                setError(`فشل تحميل بيانات الموظفين: ${err.message || 'خطأ غير معروف'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (employee: Employee) => {
        setEditingUser({ ...employee });
    };

    const handleSaveEdit = async () => {
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
    
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await registerNewEmployee(newEmployee);
            setSuccess('تم إضافة الموظف الجديد بنجاح في قاعدة البيانات ونظام الدخول.');
            setShowAddModal(false);
            // Reset form
            setNewEmployee({
                name: '', email: '', password: '', jobTitle: '', department: '',
                systemRole: SystemRole.EMPLOYEE, reportsTo: '',
                balances: { annual: 21, sick: 10, casual: 5 }
            });
            fetchEmployees();
        } catch (err: any) {
            console.error(err);
             if (err.code === 'auth/email-already-in-use') {
                setError('البريد الإلكتروني مستخدم بالفعل.');
             } else {
                setError(`فشل إضافة الموظف: ${err.message}`);
             }
        } finally {
            setLoading(false);
        }
    };

    const handleBalanceChange = (key: keyof Employee['balances'], value: string, isNew: boolean = false) => {
        const numVal = Number(value);
        if (isNew) {
            setNewEmployee(prev => ({ ...prev, balances: { ...prev.balances, [key]: numVal } }));
        } else if (editingUser) {
             setEditingUser({
                ...editingUser,
                balances: { ...editingUser.balances, [key]: numVal }
            });
        }
    };

    const getManagerName = (managerId: string | null) => {
        if (!managerId) return '-';
        const manager = employees.find(e => e.uid === managerId);
        return manager ? manager.name : 'غير معروف';
    };

    if (loading && !employees.length && !showAddModal) return <div className="flex justify-center h-64 items-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
            {error !== 'PERMISSION_DENIED' && <Notification message={error} type="error" onClose={() => setError('')} />}
            <Notification message={success} type="success" onClose={() => setSuccess('')} />

            {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة الموظفين</h1>
                    <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{employees.length} موظف</span>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow flex items-center"
                >
                    <span className="text-xl font-bold ml-2">+</span> إضافة موظف
                </button>
            </div>
            
            {employees.length === 0 && !loading && error === 'PERMISSION_DENIED' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center space-y-4">
                    <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-red-800 dark:text-red-200 font-bold text-lg">تم رفض الوصول (Permission Denied)</h3>
                        <p className="text-red-600 dark:text-red-300 text-sm max-w-lg mx-auto mt-2">
                            لا يملك حسابك الصلاحيات اللازمة لقراءة قائمة الموظفين، أو أن قواعد أمان قاعدة البيانات (Firestore Rules) لم يتم إعدادها بشكل صحيح للسماح للمسؤولين بالوصول.
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowRulesModal(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md shadow-md transition-colors font-bold"
                    >
                        عرض طريقة الإصلاح (قواعد الأمان)
                    </button>
                </div>
            )}
            
            {employees.length === 0 && !loading && error && error !== 'PERMISSION_DENIED' && (
                 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                    <p className="text-red-600 dark:text-red-300">{error}</p>
                    <button onClick={fetchEmployees} className="mt-4 text-indigo-600 hover:underline">إعادة المحاولة</button>
                 </div>
            )}

            {employees.length > 0 && (
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
            )}

            {/* ADD NEW EMPLOYEE MODAL */}
            {showAddModal && (
                 <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b pb-2">
                            إضافة موظف جديد
                        </h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الاسم الكامل *</label>
                                    <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">البريد الإلكتروني *</label>
                                    <input type="email" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">كلمة المرور *</label>
                                    <input type="password" required minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} placeholder="6 أحرف على الأقل" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">المسمى الوظيفي *</label>
                                    <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.jobTitle} onChange={e => setNewEmployee({...newEmployee, jobTitle: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">القسم *</label>
                                    <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الدور الوظيفي (النظام)</label>
                                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.systemRole} onChange={e => setNewEmployee({...newEmployee, systemRole: e.target.value as SystemRole})}>
                                        {Object.values(SystemRole).map(role => <option key={role} value={role}>{role}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">المدير المباشر</label>
                                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newEmployee.reportsTo} onChange={e => setNewEmployee({...newEmployee, reportsTo: e.target.value})}>
                                        <option value="">-- لا يوجد --</option>
                                        {employees.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.jobTitle})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mt-4">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">الأرصدة الافتتاحية</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">سنوية</label>
                                        <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:text-white" value={newEmployee.balances.annual} onChange={e => handleBalanceChange('annual', e.target.value, true)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">مرضية</label>
                                        <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:text-white" value={newEmployee.balances.sick} onChange={e => handleBalanceChange('sick', e.target.value, true)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400">عارضة</label>
                                        <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-600 dark:text-white" value={newEmployee.balances.casual} onChange={e => handleBalanceChange('casual', e.target.value, true)} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 space-x-reverse pt-4 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-white">إلغاء</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">{loading ? 'جاري الإنشاء...' : 'إنشاء الموظف'}</button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}

            {/* EDIT USER MODAL (Existing) */}
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
                                onClick={handleSaveEdit}
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