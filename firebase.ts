import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Helper to safely access process.env if available (injected by vite config or existing)
const getProcessEnv = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return (process.env as any)[key];
    }
  } catch(e) {
    // ignore
  }
  return undefined;
};

// Explicit configuration with safety checks
// We prioritize import.meta.env.VITE_... because Vite replaces these statically strings during build.
// We use ?. (optional chaining) to prevent crashes if import.meta.env itself is undefined.
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || getProcessEnv('VITE_FIREBASE_API_KEY'),
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || getProcessEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || getProcessEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || getProcessEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || getProcessEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || getProcessEnv('VITE_FIREBASE_APP_ID')
};

// Initialize Firebase services with null fallbacks
let app;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let db: Firestore | undefined;

try {
  // Check if we have the critical config
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase configuration is missing. Authentication service will not be available.");
    console.warn("Please check your .env file and ensure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID are set.");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Export services (they might be undefined if initialization failed)
export { auth, googleProvider, db };
export default app;