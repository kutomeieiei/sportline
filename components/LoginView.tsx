import React, { useState } from 'react';
import { User } from '../types';
import { Loader2, ArrowLeft, Menu, Flame, AlertCircle } from 'lucide-react';
import { APP_CONFIG } from '../constants';
import { auth, googleProvider, db } from '../firebase';

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
  const [viewMode, setViewMode] = useState<'landing' | 'login' | 'signup'>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Additional fields for signup
  const [username, setUsername] = useState('');

  const displayHeaderLogo = APP_CONFIG.headerLogoUrl || APP_CONFIG.logoUrl;

  // Helper to ensure user document exists in Firestore
  const ensureUserDocument = async (authUser: firebase.User, additionalData: { username?: string } = {}) => {
    if (!db) throw new Error("Database not initialized");
    
    let userSnap;
    try {
        userSnap = await db.collection('users').doc(authUser.uid).get();
    } catch (err) {
        console.warn("Could not fetch user profile (likely offline). Using Auth profile fallback.", err);
        // Fallback: Return a temporary user object based on Auth data
        return {
            username: additionalData.username || authUser.email?.split('@')[0] || 'user',
            displayName: authUser.displayName || additionalData.username || 'Sports Fan',
            email: authUser.email || "",
            avatarUrl: authUser.photoURL || `https://ui-avatars.com/api/?name=${authUser.displayName || 'User'}&background=random`,
            bio: "Ready to play!",
            gender: "Prefer not to say",
            preferredSports: []
        } as User;
    }

    if (!userSnap.exists) {
      const newUser: User = {
        username: additionalData.username || authUser.email?.split('@')[0] || 'user',
        displayName: authUser.displayName || additionalData.username || 'Sports Fan',
        email: authUser.email || "", // Save email
        avatarUrl: authUser.photoURL || `https://ui-avatars.com/api/?name=${authUser.displayName || 'User'}&background=random`,
        bio: "Ready to play!",
        gender: "Prefer not to say",
        preferredSports: []
      };
      
      try {
        await db.collection('users').doc(authUser.uid).set(newUser);
      } catch (writeErr: unknown) {
        console.error("Failed to create user profile in DB:", writeErr);
        const err = writeErr as { code?: string };
        if (err.code === 'permission-denied') {
             alert("⚠️ Account created, but Profile saving failed.\n\nDatabase Permission Denied. Check Firebase Console > Firestore Database > Rules.");
        }
      }
      return newUser;
    } else {
        // User exists: Update latest email and avatar from Google Auth if available
        // This ensures the "Gmail saving" requirement is robust
        const userData = userSnap.data() as User;
        const updates: Record<string, unknown> = {};
        
        if (authUser.email && userData.email !== authUser.email) {
            updates.email = authUser.email;
            userData.email = authUser.email;
        }
        
        if (authUser.photoURL && userData.avatarUrl !== authUser.photoURL) {
            // Only update avatar if it hasn't been manually set to something else custom
            // For now, we sync it to keep it fresh
            updates.avatarUrl = authUser.photoURL;
            userData.avatarUrl = authUser.photoURL;
        }

        if (Object.keys(updates).length > 0) {
            try {
                await db.collection('users').doc(authUser.uid).set(updates, { merge: true });
            } catch {
                // Ignore write errors for updates
            }
        }
        return userData;
    }
  };

  const formatError = (err: unknown) => {
    console.error("Auth Error Object:", err);
    const error = err as { code?: string; message?: string };

    if (error.code === 'auth/unauthorized-domain') {
      return "Domain not allowed. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add this domain.";
    }
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/user-cancelled') {
      return "Login cancelled. If you did not close the popup, you likely need to add this domain/IP (e.g., 127.0.0.1) to Firebase Console > Authentication > Settings > Authorized Domains.";
    }
    if (error.code === 'auth/email-already-in-use') {
      return "This email is already registered. Please log in.";
    }
    if (error.code === 'auth/invalid-credential') {
      return "Invalid email or password.";
    }
    if (error.code === 'auth/popup-blocked') {
        return "Popup blocked. Please allow popups for this site.";
    }
    if (error.code === 'auth/operation-not-allowed') {
        return "Google Sign-In is not enabled. Go to Firebase Console > Authentication > Sign-in method and enable Google.";
    }
    if (error.message && error.message.includes('offline')) {
        return "You are offline. Please check your internet connection.";
    }
    return error.message ? error.message.replace('Firebase: ', '') : "An unknown error occurred.";
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (!auth) {
        setError("Firebase configuration missing. Cannot log in.");
        setIsLoading(false);
        return;
    }

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (userCredential.user) {
          const userProfile = await ensureUserDocument(userCredential.user);
          onLogin(userProfile);
      }
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!auth) {
        setError("Firebase configuration missing. Cannot sign up.");
        setIsLoading(false);
        return;
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      // Update Auth Profile
      await userCredential.user?.updateProfile({
        displayName: username
      });
      
      if (userCredential.user) {
        const userProfile = await ensureUserDocument(userCredential.user, { username });
        onLogin(userProfile);
      }
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

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
        if (result.user) {
            const userProfile = await ensureUserDocument(result.user);
            onLogin(userProfile);
        }
    } catch (err: unknown) {
        setError(formatError(err));
        setIsLoading(false);
    }
  };

  const resetForm = () => {
    setError(null);
    setEmail('');
    setPassword('');
    setUsername('');
  };

  // --- LANDING SCREEN (First View) ---
  if (viewMode === 'landing') {
    return (
      <div className="relative w-full h-full min-h-screen overflow-hidden flex flex-col font-sans bg-black">
        
        {/* Background Video */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60 z-0"
        >
          {/* 
            HOW TO USE YOUR OWN VIDEO:
            
            Option 1: Local File (Recommended for best performance)
            1. Create a folder named "public" in the root of your project if it doesn't exist.
            2. Place your video file (e.g., "my-background.mp4") inside the "public" folder.
            3. Change the src below to: src="/my-background.mp4"
            
            Option 2: Direct URL (Like Firebase Storage, AWS S3, or Pixabay)
            1. Upload your video to a hosting service that provides direct .mp4 links.
            2. Paste the direct link below.
            
            NOTE ON GOOGLE DRIVE: 
            Google Drive links (like drive.google.com/file/d/...) DO NOT WORK directly in <video> tags 
            because Google blocks direct streaming. You must use Option 1 or a proper video host.
          */}
          <source src="https://pixabay.com/videos/download/video-336704_source.mp4" type="video/mp4" />
        </video>

        {/* Top Bar */}
        <div className="relative z-10 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {displayHeaderLogo && (
                    <img src={displayHeaderLogo} alt="Logo" className="h-8 object-contain brightness-0 invert" />
                )}
            </div>
            <button className="text-white hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-sm">
                <Menu size={28} />
            </button>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col items-center animate-in zoom-in duration-500 border border-white/20">
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
                     <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase drop-shadow-sm mb-8">
                         Sport<span className="text-red-500">Line</span>
                     </h1>
                   </>
                )}

                {/* Actions inside the box */}
                <div className="w-full space-y-4">
                    <button 
                        onClick={() => { setViewMode('signup'); resetForm(); }}
                        className={`w-full py-3.5 rounded-full text-white font-bold text-lg tracking-wide shadow-lg transform active:scale-95 transition-transform ${APP_CONFIG.primaryGradient}`}
                    >
                        Create Account
                    </button>

                    <button 
                        onClick={() => { setViewMode('login'); resetForm(); }}
                        className="w-full py-3.5 rounded-full bg-transparent border-2 border-gray-200 text-gray-700 font-bold text-lg tracking-wide hover:bg-gray-50 transform active:scale-95 transition-all"
                    >
                        Log In
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- LOGIN / SIGNUP FORM (Overlay) ---
  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-black flex flex-col font-sans">
       
       {/* Video Background */}
       <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none z-0"
        >
          <source src="https://pixabay.com/videos/download/video-336704_source.mp4" type="video/mp4" />
        </video>

       <div className="px-4 py-4 flex items-center relative z-10">
            <button 
                onClick={() => setViewMode('landing')}
                className="p-2 -ml-2 text-white hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
            >
                <ArrowLeft size={28} />
            </button>
       </div>

       <div className="flex-1 px-6 flex flex-col items-center justify-center pt-4 overflow-y-auto relative z-10 pb-12">
            <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col items-center animate-in zoom-in duration-500 border border-white/20">
                <div className="mb-4">
                    {APP_CONFIG.logoUrl ? (
                        <img src={APP_CONFIG.logoUrl} alt="Logo" className="h-24 w-auto object-contain drop-shadow-md" />
                    ) : (
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${APP_CONFIG.primaryGradient}`}>
                            <Flame className="text-white fill-white" size={32} />
                        </div>
                    )}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {viewMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                </h2>

                <div className="w-full space-y-6">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full py-3.5 rounded-full border border-gray-300 bg-white text-gray-700 font-bold text-base shadow-sm hover:bg-gray-50 flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                        <GoogleIcon />
                        <span>Continue with Google</span>
                    </button>

                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <span className="relative bg-white px-4 text-sm text-gray-500 font-medium">or</span>
                    </div>

                    {error && (
                        <div className="bg-red-50 p-3 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={viewMode === 'login' ? handleLoginSubmit : handleSignupSubmit} className="space-y-4">
                        
                        {viewMode === 'signup' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">Display Name</label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-medium"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Email</label>
                            <input
                                type="email"
                                required
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-medium"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-medium"
                                placeholder="••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 rounded-full text-white font-bold text-lg tracking-wide shadow-lg transform active:scale-95 transition-transform ${APP_CONFIG.primaryGradient}`}
                        >
                            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (viewMode === 'login' ? 'Log In' : 'Create Account')}
                        </button>
                    </form>
                </div>
            </div>
       </div>
    </div>
  );
};

export default LoginView;