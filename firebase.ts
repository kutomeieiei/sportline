import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Helper to safely access environment variables
// This handles cases where import.meta.env might be undefined or process.env is needed as fallback
const getEnv = (key: string): string | undefined => {
  try {
    // Check import.meta.env (Standard Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key];
      if (typeof val === 'string') {
        return val;
      }
    }
  } catch (e) {
    // Ignore errors accessing import.meta
  }

  try {
    // Check process.env (Polyfilled via vite.config.ts)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      const val = process.env[key];
      if (typeof val === 'string') {
        return val;
      }
    }
  } catch (e) {
    // Ignore errors accessing process
  }

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
  // Check if we have the critical config
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Initialize Firestore with offline persistence enabled
    // This dramatically improves performance (zero-latency writes) and allows offline usage
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    storage = getStorage(app);
    console.log("Firebase initialized successfully with persistence");
  } else {
    console.warn("Firebase configuration is missing or incomplete. Authentication service will not be available.");
    console.log("Debug Config Status:", {
      hasApiKey: !!firebaseConfig.apiKey,
      hasProjectId: !!firebaseConfig.projectId,
      hasAuthDomain: !!firebaseConfig.authDomain
    });
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Export services
export { auth, googleProvider, db, storage };
export default app;