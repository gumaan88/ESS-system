import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import Notification from '../components/Notification';
import { FirebaseError } from 'firebase/app';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login Error:", err);
      let errorMessage = 'فشل تسجيل الدخول. يرجى التحقق من بياناتك والمحاولة مرة أخرى.';
       if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
             errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
             break;
          case 'auth/user-disabled':
             errorMessage = 'تم تعطيل هذا الحساب من قبل المسؤول.';
             break;
          default:
             break;
        }
      }
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-gray-900">
      <Notification message={error} type="error" onClose={() => setError('')} />
      
      {/* Left side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:flex-none lg:px-24 bg-white dark:bg-gray-800 shadow-2xl z-10">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center mb-10">
            <img 
              src="https://alawn.org/assets/images/logo/logo-dark.png" 
              alt="Al-Awn Foundation" 
              className="h-20 mx-auto mb-6 dark:brightness-0 dark:invert" 
            />
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">بوابة الموظف الذكية</h1>
            <p className="mt-2 text-slate-500 dark:text-gray-400">مؤسسة العون للتنمية - الإدارة الرقمية</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-gray-300">البريد الإلكتروني المؤسسي</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="name@alawn.org"
              />
            </div>

            <div>
              <label htmlFor="password"  className="block text-sm font-bold text-slate-700 dark:text-gray-300">كلمة المرور</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100 dark:shadow-none font-black hover:bg-teal-700 hover:-translate-y-0.5 transition-all disabled:bg-teal-300"
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-12 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} مؤسسة العون للتنمية. جميع الحقوق محفوظة.
          </div>
        </div>
      </div>

      {/* Right side: Image/Branding */}
      <div className="hidden lg:block relative flex-1 bg-teal-800">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/80 to-[#1a2b3c]/90 z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000" 
          alt="Office" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-5xl font-black text-white mb-6 leading-tight">نسعى لتنمية <br/><span className="text-teal-300">الإنسان</span> وبناء <br/>المستقبل</h2>
            <div className="w-24 h-1 bg-teal-400 rounded-full"></div>
            <p className="mt-8 text-teal-50 max-w-md text-lg opacity-80">نظام الخدمات الذاتية يهدف إلى تسريع الإجراءات الإدارية ودعم التحول الرقمي الشامل للمؤسسة.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;