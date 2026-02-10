import React, { useState } from 'react';
import { User } from '../types';
import { Loader2 } from 'lucide-react';

// --- LOGIN CONFIGURATION ---
const LOGIN_CONFIG = {
  // Set to true to display the image logo, set to false to display the "Sport Line" text
  showLogoImage: true, 
  
  // Replace this URL with your actual logo file path (e.g., '/assets/logo.png')
  logoImageUrl: "https://media.discordapp.net/attachments/881775150855516160/1470751152248459306/IMG_20260210_185929.jpg?ex=698c6f3f&is=698b1dbf&hm=91620b456d38d17b5ccd62672c99696d60b40732d771f8065835200b61ed129d&=&format=webp",
  
  // Tailwind classes to control logo size and spacing
  logoImageClasses: "w-64 mb-6 object-contain"
};

interface LoginViewProps {
  onLogin: (user: User) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API network delay
    setTimeout(() => {
      // Mock successful login
      const username = identifier || "User";
      
      const mockUser: User = {
        username: username.toLowerCase().replace(/\s/g, ''),
        displayName: username,
        avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=fe0000&color=fff&bold=true`,
        bio: "I'm new to Sport Line!",
        gender: "Prefer not to say",
        preferredSports: []
      };
      
      onLogin(mockUser);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-8 py-12 relative font-sans">
      
      {/* Logo Section */}
      <div className="flex flex-col items-center mb-6 mt-10">
        {LOGIN_CONFIG.showLogoImage ? (
          <img 
            src={LOGIN_CONFIG.logoImageUrl} 
            alt="App Logo" 
            className={LOGIN_CONFIG.logoImageClasses}
          />
        ) : (
          <>
            <h1 className="text-6xl font-extrabold text-black tracking-tighter" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}>
              Sport
            </h1>
            <h1 className="text-6xl font-extrabold text-black tracking-tighter -mt-2" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}>
              Line
            </h1>
          </>
        )}
      </div>

      {/* Login Header Box */}
      <div className="border-[3px] border-black rounded-2xl px-12 py-2 mb-12">
        <h2 className="text-xl font-bold text-black">เข้าสู่ระบบ</h2>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-6">
        
        {/* Username Input */}
        <div className="w-full">
            <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full py-2 bg-transparent border-b-4 border-gray-300 text-gray-600 placeholder-gray-400 outline-none focus:border-gray-500 transition-colors text-lg font-medium"
                placeholder="ชื่อผู้ใช้ / เบอร์โทร ..."
            />
        </div>

        {/* Password Input */}
        <div className="w-full">
            <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2 bg-transparent border-b-4 border-gray-300 text-gray-600 placeholder-gray-400 outline-none focus:border-gray-500 transition-colors text-lg font-medium"
                placeholder="รหัสผ่าน ..."
            />
        </div>

        {/* Helper Links */}
        <div className="flex justify-between items-center w-full mt-2">
            <button type="button" className="text-xs text-gray-500 font-medium hover:text-gray-700">
                ยังไม่มีบัญชี? สมัครสมาชิก
            </button>
            <button type="button" className="text-xs text-gray-500 font-medium hover:text-gray-700">
                ลืมรหัสผ่าน?
            </button>
        </div>

        {/* Submit Button */}
        <button
            type="submit"
            disabled={isLoading}
            className="w-3/4 mx-auto mt-8 border-[3px] border-gray-400 text-gray-500 font-bold text-xl py-2 rounded-2xl hover:bg-gray-50 hover:text-gray-600 hover:border-gray-500 active:scale-95 transition-all flex items-center justify-center"
        >
            {isLoading ? <Loader2 className="animate-spin" /> : 'เข้าสู่ระบบ'}
        </button>

      </form>

    </div>
  );
};

export default LoginView;