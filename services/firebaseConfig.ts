import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Safely access environment variables
// @ts-ignore
const env = (import.meta && import.meta.env) ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Check if API key is present to warn developer
if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is missing. Please check your .env file and ensure variables start with VITE_");
}

// Singleton pattern: Initialize app only if not already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export initialized services
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };