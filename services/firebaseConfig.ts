import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Explicitly access import.meta.env properties for Vite static replacement
// @ts-ignore
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
// @ts-ignore
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
// @ts-ignore
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
// @ts-ignore
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
// @ts-ignore
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
// @ts-ignore
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
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