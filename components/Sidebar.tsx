import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SystemRole } from '../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const location = useLocation();
  const { pathname } = location;

  const trigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  
  const { employeeData } = useAuth();
  
  const isManagerOrAdmin = employeeData && [
    SystemRole.HOD, 
    SystemRole.HR_MANAGER, 
    SystemRole.FINANCE_MANAGER, 
    SystemRole.HR_ADMIN, 
    SystemRole.HR_SPECIALIST,
    SystemRole.CFO, 
    SystemRole.CEO
  ].includes(employeeData.systemRole);

  const isAdmin = employeeData && employeeData.systemRole === SystemRole.HR_ADMIN;

  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen || sidebar.current.contains(target as Node) || trigger.current.contains(target as Node)) return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  const navItemClass = (isActive: boolean) => 
    `flex items-center px-4 py-3 rounded-xl mb-1 transition-all duration-200 group ${
      isActive 
      ? 'bg-teal-600 text-white shadow-lg shadow-teal-200 dark:shadow-none' 
      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
    }`;

  return (
    <div>
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      ></div>

      <div
        id="sidebar"
        ref={sidebar}
        className={`flex flex-col absolute z-40 end-0 top-0 lg:static lg:start-auto lg:top-auto lg:translate-x-0 transform h-screen no-scrollbar w-72 shrink-0 bg-[#1a2b3c] p-4 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-72'
        }`}
      >
        <div className="flex justify-between items-center mb-10 px-2">
          <button
            ref={trigger}
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <NavLink end to="/" className="block mx-auto">
            <img 
              src="https://alawn.org/assets/images/logo/logo-dark.png" 
              alt="Al-Awn Foundation" 
              className="h-14 brightness-0 invert" 
            />
          </NavLink>
        </div>

        <div className="space-y-1">
          <h3 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider ps-4 mb-4">القائمة الرئيسية</h3>
          
          <NavLink end to="/dashboard" className={({ isActive }) => navItemClass(isActive)}>
            <span className="text-xl">📊</span>
            <span className="ms-3 font-medium">لوحة التحكم</span>
          </NavLink>

          <NavLink end to="/inbox" className={({ isActive }) => navItemClass(isActive)}>
            <span className="text-xl">📥</span>
            <span className="ms-3 font-medium">صندوق الوارد</span>
          </NavLink>

          <NavLink end to="/my-requests" className={({ isActive }) => navItemClass(isActive)}>
            <span className="text-xl">📂</span>
            <span className="ms-3 font-medium">طلباتي</span>
          </NavLink>

          {isAdmin && (
            <>
                <h3 className="text-[10px] uppercase text-gray-500 font-bold tracking-wider ps-4 mt-8 mb-4">الإدارة</h3>
                <NavLink end to="/admin" className={({ isActive }) => navItemClass(isActive)}>
                <span className="text-xl">⚙️</span>
                <span className="ms-3 font-medium">إعدادات النظام</span>
                </NavLink>
            </>
          )}
        </div>

        <div className="mt-auto p-4 bg-teal-900/30 rounded-2xl border border-teal-800/50">
          <p className="text-[10px] text-teal-400 font-bold mb-1">تحتاج مساعدة؟</p>
          <p className="text-xs text-gray-400">تواصل مع قسم تكنولوجيا المعلومات بالمؤسسة</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;