import React, { useState } from 'react';
import { User } from '../types';
import { Loader2, ArrowLeft, Menu, Flame } from 'lucide-react';
import { APP_CONFIG } from '../constants';

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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const displayHeaderLogo = APP_CONFIG.headerLogoUrl || APP_CONFIG.logoUrl;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API network delay
    setTimeout(() => {
      const username = identifier || "User";
      
      const mockUser: User = {
        username: username.toLowerCase().replace(/\s/g, ''),
        displayName: username,
        avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=fe0000&color=fff&bold=true`,
        bio: "Ready to play!",
        gender: "Prefer not to say",
        preferredSports: []
      };
      
      onLogin(mockUser);
      setIsLoading(false);
    }, 1500);
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
        const mockGoogleUser: User = {
            username: "google_user",
            displayName: "Google User",
            avatarUrl: "https://ui-avatars.com/api/?name=Google+User&background=4285F4&color=fff&bold=true",
            bio: "Joined via Google",
            gender: "Prefer not to say",
            preferredSports: []
        };
        onLogin(mockGoogleUser);
        setIsLoading(false);
    }, 1500);
  };

  // --- LANDING SCREEN (First View) ---
  if (viewMode === 'landing') {
    return (
      <div className="relative w-full h-screen overflow-hidden flex flex-col font-sans bg-white">
        
        {/* Top Bar */}
        <div className="relative z-10 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {displayHeaderLogo ? (
                    <img src={displayHeaderLogo} alt="Logo" className="h-8 object-contain" />
                ) : (
                    // Default Top Left Logo (Hidden or minimal if main logo is center)
                    <div className="flex items-center gap-1 opacity-0"> 
                        <span className={`text-xl font-bold tracking-wide ${APP_CONFIG.textGradient}`}>{APP_CONFIG.appName}</span>
                    </div>
                )}
            </div>
            {/* Menu Icon */}
            <button className="text-gray-900 hover:bg-gray-100 p-2 rounded-full transition-colors">
                <Menu size={28} />
            </button>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="flex flex-col items-center animate-in zoom-in duration-500">
                {APP_CONFIG.logoUrl ? (
                   // CUSTOM IMAGE LOGO - UPDATED SIZE (Bigger)
                   <img 
                      src={APP_CONFIG.logoUrl} 
                      alt={APP_CONFIG.appName} 
                      className="w-80 md:w-96 h-auto object-contain drop-shadow-xl mb-6"
                   />
                ) : (
                   // DEFAULT CONSTRUCTED LOGO
                   <>
                     {/* Icon Circle */}
                     <div className={`w-32 h-32 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 transform -rotate-6 ${APP_CONFIG.primaryGradient}`}>
                          <Flame className="text-white fill-white" size={64} />
                     </div>
                     {/* Text Logo */}
                     <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase drop-shadow-sm">
                         Sport<span className="text-red-500">Line</span>
                     </h1>
                     <p className="text-gray-400 text-sm font-semibold tracking-widest mt-2 uppercase">
                         Matchmaking App
                     </p>
                   </>
                )}
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="relative z-10 px-6 pb-12 w-full max-w-md mx-auto space-y-4">
            {/* Create Account Button (Gradient Background) */}
            <button 
                onClick={() => setViewMode('signup')}
                className={`w-full py-3.5 rounded-full text-white font-bold text-lg tracking-wide shadow-lg transform active:scale-95 transition-transform ${APP_CONFIG.primaryGradient}`}
            >
                สร้างบัญชี
            </button>

            {/* Log In Button (Outlined with dark text) */}
            <button 
                onClick={() => setViewMode('login')}
                className="w-full py-3.5 rounded-full bg-transparent border-2 border-gray-200 text-gray-700 font-bold text-lg tracking-wide hover:bg-gray-50 transform active:scale-95 transition-all"
            >
                เข้าสู่ระบบ
            </button>
            
            <p className="text-xs text-gray-400 text-center mt-4 font-medium">
                Trouble logging in? <span className="underline cursor-pointer hover:text-gray-600">Get Help</span>
            </p>
        </div>
      </div>
    );
  }

  // --- LOGIN / SIGNUP FORM (Overlay) ---
  return (
    <div className="relative w-full h-screen overflow-hidden bg-white flex flex-col font-sans">
       
       {/* Header */}
       <div className="px-4 py-4 flex items-center">
            <button 
                onClick={() => setViewMode('landing')}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
                <ArrowLeft size={28} />
            </button>
       </div>

       <div className="flex-1 px-8 flex flex-col items-center pt-8">
            {/* Logo in Form */}
            <div className="mb-6">
                {APP_CONFIG.logoUrl ? (
                    // UPDATED SIZE (Bigger)
                    <img src={APP_CONFIG.logoUrl} alt="Logo" className="h-32 w-auto object-contain drop-shadow-md" />
                ) : (
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${APP_CONFIG.primaryGradient}`}>
                        <Flame className="text-white fill-white" size={32} />
                    </div>
                )}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {viewMode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </h2>

            <div className="w-full max-w-sm space-y-6">
                {/* Google Login Button */}
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

                <form onSubmit={handleLoginSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Username / Phone</label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-medium"
                            placeholder="Enter your username"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-medium"
                            placeholder="Enter your password"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button type="button" className="text-sm font-semibold text-gray-500 hover:text-red-500">
                            Forgot Password?
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-4 rounded-full text-white font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center ${APP_CONFIG.primaryGradient}`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : (viewMode === 'login' ? 'LOG IN' : 'CONTINUE')}
                    </button>
                </form>
            </div>
       </div>

       {/* Terms */}
       <div className="p-6 text-center">
            <p className="text-xs text-gray-400">
                By clicking Log In, you agree with our <span className="underline">Terms</span>. 
                Learn how we process your data in our <span className="underline">Privacy Policy</span>.
            </p>
       </div>
    </div>
  );
};

export default LoginView;