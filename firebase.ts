import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Helper to safely access process.env if available (injected by vite config or existing)
const getProcessEnv = (key: string) => {
  try {
    // We access process.env directly. If it's replaced by Vite's define, this works.
    // If it's not replaced and process is undefined, this throws and we catch it.
    // @ts-ignore
    return process.env[key];
  } catch(e) {
    return undefined;
  }
};

// Explicit configuration with safety checks.
// We use direct property access 'import.meta.env.VITE_...' to ensure Vite performs static replacement.
// We use logical OR to fallback to process.env if the static replacement yields undefined.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || getProcessEnv('VITE_FIREBASE_API_KEY'),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || getProcessEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || getProcessEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || getProcessEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || getProcessEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || getProcessEnv('VITE_FIREBASE_APP_ID')
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
    console.log("Debug Config:", JSON.stringify(firebaseConfig, null, 2));
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Export services (they might be undefined if initialization failed)
export { auth, googleProvider, db };
export default app;