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

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen || sidebar.current.contains(target as Node) || trigger.current.contains(target as Node)) return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  return (
    <div>
      {/* Sidebar backdrop (mobile only) */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-30 z-40 lg:hidden lg:z-auto transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <div
        id="sidebar"
        ref={sidebar}
        className={`flex flex-col absolute z-40 end-0 top-0 lg:static lg:start-auto lg:top-auto lg:translate-x-0 transform h-screen overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 lg:w-20 lg:sidebar-expanded:!w-64 2xl:!w-64 shrink-0 bg-gray-800 p-4 transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex justify-between mb-10 pe-3 sm:pe-2">
          {/* Close button */}
          <button
            ref={trigger}
            className="lg:hidden text-gray-500 hover:text-gray-400"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.7 18.7l1.4-1.4L7.8 13H20v-2H7.8l4.3-4.3-1.4-1.4L4 12z" />
            </svg>
          </button>
          {/* Logo */}
          <NavLink end to="/" className="block">
            <h1 className="text-white text-2xl font-bold">بوابة</h1>
          </NavLink>
        </div>

        {/* Links */}
        <div className="space-y-8">
          <div>
            <h3 className="text-xs uppercase text-gray-500 font-semibold ps-3">الصفحات</h3>
            <ul className="mt-3">
              <li className={`px-3 py-2 rounded-sm mb-0.5 last:mb-0 ${pathname === '/dashboard' && 'bg-gray-900'}`}>
                <NavLink end to="/dashboard" className="block text-gray-200 hover:text-white truncate transition duration-150">
                  <div className="flex items-center">
                    <span className="text-xl">🏠</span>
                    <span className="text-sm font-medium ms-3 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">لوحة التحكم</span>
                  </div>
                </NavLink>
              </li>
              
              <li className={`px-3 py-2 rounded-sm mb-0.5 last:mb-0 ${pathname === '/my-requests' && 'bg-gray-900'}`}>
                <NavLink end to="/my-requests" className="block text-gray-200 hover:text-white truncate transition duration-150">
                  <div className="flex items-center">
                    <span className="text-xl">📂</span>
                    <span className="text-sm font-medium ms-3 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">طلباتي</span>
                  </div>
                </NavLink>
              </li>

              {isManagerOrAdmin && (
                 <li className={`px-3 py-2 rounded-sm mb-0.5 last:mb-0 ${pathname.includes('inbox') && 'bg-gray-900'}`}>
                    <NavLink end to="/inbox" className="block text-gray-200 hover:text-white truncate transition duration-150">
                    <div className="flex items-center">
                         <span className="text-xl">📥</span>
                        <span className="text-sm font-medium ms-3 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">صندوق الوارد</span>
                    </div>
                    </NavLink>
                 </li>
              )}
               {isAdmin && (
                 <li className={`px-3 py-2 rounded-sm mb-0.5 last:mb-0 ${pathname.includes('admin') && 'bg-gray-900'}`}>
                    <NavLink end to="/admin" className="block text-gray-200 hover:text-white truncate transition duration-150">
                    <div className="flex items-center">
                        <span className="text-xl">⚙️</span>
                        <span className="text-sm font-medium ms-3 lg:opacity-0 lg:sidebar-expanded:opacity-100 2xl:opacity-100 duration-200">لوحة الإدارة</span>
                    </div>
                    </NavLink>
                 </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;