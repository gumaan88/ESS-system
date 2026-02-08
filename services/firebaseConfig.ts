import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// الوصول للمتغيرات البيئية مباشرة لتجنب أخطاء Undefined في بعض بيئات التشغيل
export const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
};

// التحقق من وجود المفاتيح لتنبيه المطور
if (!firebaseConfig.apiKey) {
  console.error("Firebase Configuration Error: VITE_FIREBASE_API_KEY is missing.");
}

// تهيئة التطبيق بنمط Singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// تصدير الخدمات
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };