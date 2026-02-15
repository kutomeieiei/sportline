import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Helper to safely access environment variables
const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key];
      if (typeof val === 'string') return val;
    }
  } catch (e) {}

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      const val = process.env[key];
      if (typeof val === 'string') return val;
    }
  } catch (e) {}

  return undefined;
};

const firebaseConfig: FirebaseOptions = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Initialize Firebase services
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // NUCLEAR FIX REVISED:
    // 1. localCache: memoryLocalCache() -> Prevents IndexedDB locks.
    // 2. REMOVED experimentalForceLongPolling -> Reverting to standard WebSockets.
    //    Long Polling can sometimes cause timeouts if the network is actually fine but the polling fails.
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    
    storage = getStorage(app);
    console.log(`Firebase initialized successfully (Memory Cache). Project ID: ${firebaseConfig.projectId}`);
  } else {
    console.warn("Firebase configuration is missing or incomplete.");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { auth, googleProvider, db, storage };
export default app;