import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Spinner from './components/Spinner';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewRequest = lazy(() => import('./pages/NewRequest'));
const RequestForm = lazy(() => import('./pages/RequestForm'));
const RequestDetails = lazy(() => import('./pages/RequestDetails'));
const ManagerInbox = lazy(() => import('./pages/ManagerInbox'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ServiceBuilder = lazy(() => import('./pages/admin/ServiceBuilder'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, employeeData, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (roles && employeeData && !roles.includes(employeeData.systemRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="new-request" element={<NewRequest />} />
          <Route path="request-form/:serviceId" element={<RequestForm />} />
          <Route path="request/:requestId" element={<RequestDetails />} />
          <Route path="inbox" element={<ProtectedRoute roles={['MANAGER', 'HR_ADMIN', 'CFO', 'CEO']}><ManagerInbox /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['HR_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/services/new" element={<ProtectedRoute roles={['HR_ADMIN']}><ServiceBuilder /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;