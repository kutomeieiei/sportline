import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 1. Config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID 
};

// 2. Initialize App (Singleton)
// We check if apps are already initialized to avoid "Firebase App named '[DEFAULT]' already exists" errors
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Initialize Services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Use default settings for Firestore (best for general compatibility)
const db = getFirestore(app);

const storage = getStorage(app);

console.log("Firebase Initialized:", { 
  projectId: firebaseConfig.projectId, 
  authDomain: firebaseConfig.authDomain 
});

export { auth, googleProvider, db, storage };
export default app;