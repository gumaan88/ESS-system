import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// الوصول للمتغيرات البيئية بشكل آمن لتجنب أخطاء Undefined
const env = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// التحقق من وجود المفاتيح لتنبيه المطور
if (!firebaseConfig.apiKey) {
  console.error("Firebase Configuration Error: VITE_FIREBASE_API_KEY is missing. Please check your .env file.");
}

// تهيئة التطبيق بنمط Singleton (Compat style)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// تصدير الخدمات
const app = firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();

export { app, auth, db };
export default firebase;