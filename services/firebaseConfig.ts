import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Access environment variables safely by casting import.meta to any
const env = (import.meta as any).env;

// في Vite، نستخدم import.meta.env مباشرة للسماح للمجمع باستبدال القيم أثناء البناء
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
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