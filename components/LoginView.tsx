import React, { useState } from 'react';
import { User } from '../types';
import { Loader2, Flame, AlertCircle } from 'lucide-react';
import { APP_CONFIG } from '../constants';
import { auth, googleProvider, db, firebase } from '../firebase';
import { fallbackAvatar } from '../utils/image';
import { normalizeUsername, pickFreeUsername } from '../utils/username';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Makes sure the signed-in user has a complete profile in Firestore.
  // New users get a unique username and their Google name/photo.
  const ensureUserDocument = async (authUser: firebase.User): Promise<User> => {
    if (!db) throw new Error("Database not initialized");

    const name = authUser.displayName || 'Sports Fan';
    const photo = authUser.photoURL || fallbackAvatar(name);
    const userRef = db.collection('users').doc(authUser.uid);

    let userSnap;
    try {
      userSnap = await userRef.get();
    } catch (err) {
      console.warn("Could not fetch user profile (likely offline). Using Auth profile fallback.", err);
      return {
        uid: authUser.uid,
        username: normalizeUsername(authUser.email?.split('@')[0] || 'user'),
        display_name: name,
        displayName: name,
        email: authUser.email || "",
        profile_img_url: photo,
        avatarUrl: photo,
        bio: "Ready to play!",
        gender: "Prefer not to say",
        preferred_sports: [],
        skill_metrics: { endurance: 0, speed: 0, technique: 0, teamwork: 0 },
      };
    }

    const existing = (userSnap.exists ? userSnap.data() : {}) as Partial<User>;
    const updates: Record<string, unknown> = {};

    // Fill in anything missing (new users, or profiles made by older app versions).
    if (!existing.username) {
      updates.username = await pickFreeUsername(authUser.email?.split('@')[0] || name, authUser.uid);
    }
    if (!existing.display_name) updates.display_name = existing.displayName || name;
    if (!existing.displayName) updates.displayName = existing.display_name || name;
    if (!existing.profile_img_url) updates.profile_img_url = existing.avatarUrl || photo;
    if (!existing.preferred_sports) updates.preferred_sports = [];
    if (existing.bio === undefined) updates.bio = "Ready to play!";
    if (!existing.gender) updates.gender = "Prefer not to say";
    // Keep the email and Google photo in sync (custom photos live in profile_img_url).
    if (authUser.email && existing.email !== authUser.email) updates.email = authUser.email;
    if (authUser.photoURL && existing.avatarUrl !== authUser.photoURL) updates.avatarUrl = authUser.photoURL;

    if (Object.keys(updates).length > 0) {
      try {
        await userRef.set(updates, { merge: true });
      } catch (writeErr) {
        console.error("Failed to save user profile:", writeErr);
      }
    }
    return { ...existing, ...updates, uid: authUser.uid } as User;
  };

  const formatError = (err: unknown) => {
    console.error("Auth Error Object:", err);
    const error = err as { code?: string; message?: string };

    if (error.code === 'auth/unauthorized-domain') {
      return "This website isn't allowed to sign in yet. Add its domain in Firebase Console > Authentication > Settings > Authorized domains.";
    }
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/user-cancelled') {
      return "Sign-in was cancelled. Please try again.";
    }
    if (error.code === 'auth/popup-blocked') {
      return "Popup blocked. Please allow popups for this site and try again.";
    }
    if (error.code === 'auth/operation-not-allowed') {
      return "Google Sign-In is not enabled. Go to Firebase Console > Authentication > Sign-in method and enable Google.";
    }
    if (error.message && error.message.includes('offline')) {
      return "You are offline. Please check your internet connection.";
    }
    return error.message ? error.message.replace('Firebase: ', '') : "An unknown error occurred.";
  };

  // Google is the only sign-in method. Email/password sign-up was removed because
  // it let anyone create accounts with made-up emails.
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    if (!auth || !googleProvider) {
      setError("Firebase configuration missing.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await auth.signInWithPopup(googleProvider);
      const signedInWithGoogle = result.additionalUserInfo?.providerId === 'google.com'
        || result.credential?.providerId === 'google.com';
      if (result.user && signedInWithGoogle) {
        const userProfile = await ensureUserDocument(result.user);
        onLogin(userProfile);
      } else {
        await auth.signOut();
        setError("Please sign in with a Google account.");
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setError(formatError(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden flex flex-col font-sans bg-black">

      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none z-0"
      >
        <source src="https://pixabay.com/videos/download/video-336704_source.mp4" type="video/mp4" />
      </video>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="bg-zinc-900/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col items-center animate-in zoom-in duration-500 border border-zinc-800">
          {APP_CONFIG.logoUrl ? (
            <img
              src={APP_CONFIG.logoUrl}
              alt={APP_CONFIG.appName}
              className="w-64 md:w-80 h-auto object-contain drop-shadow-xl mb-8"
            />
          ) : (
            <>
              <div className={`w-24 h-24 rounded-2xl flex items-center justify-center shadow-xl mb-6 transform -rotate-6 ${APP_CONFIG.primaryGradient}`}>
                <Flame className="text-white fill-white" size={48} />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase drop-shadow-sm mb-8">
                Sport<span className="text-red-500">Sphere</span>
              </h1>
            </>
          )}

          <div className="w-full space-y-4">
            {error && (
              <div className="bg-red-900/30 p-3 rounded-lg flex items-start gap-2 text-red-500 text-sm border border-red-900/50 text-left">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3.5 rounded-full bg-white text-zinc-900 font-bold text-base shadow-lg hover:bg-zinc-100 disabled:opacity-60 flex items-center justify-center gap-3 transition-all active:scale-95 duration-200"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <GoogleIcon />}
              <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            <p className="text-xs text-zinc-500">
              Sign in with your Google (Gmail) account to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;