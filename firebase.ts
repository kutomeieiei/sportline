import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
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
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Initialize Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 4. Initialize Firestore
// We use memoryLocalCache to avoid indexDB locks during development hot-reloads.
// In production, you might switch this to persistentLocalCache if needed, but memory is safer for now.
const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

// 5. Initialize Storage
const storage = getStorage(app);

console.log("Firebase Services Initialized:", { 
  projectId: firebaseConfig.projectId, 
  auth: !!auth, 
  db: !!db 
});

export { auth, googleProvider, db, storage };
export default app;