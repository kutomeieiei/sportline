import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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

// Validation
if (!firebaseConfig.apiKey) {
    console.error("CRITICAL: Firebase Configuration is missing. Check your .env file.");
}

// 2. Initialize App (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Initialize Services
const auth = getAuth(app);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

console.log("Firebase Initialized (Modular Mode):", { 
  projectId: firebaseConfig.projectId, 
  authDomain: firebaseConfig.authDomain 
});

export { auth, googleProvider, db, storage };
export default app;
