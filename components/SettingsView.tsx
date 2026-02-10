import React, { useState } from 'react';
import { User } from '../types';
import { Camera, Save, ArrowLeft, LogOut, Shield, Bell, HelpCircle } from 'lucide-react';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onClose, onLogout }) => {
  const [username, setUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdateUser({ username, avatarUrl });
    setIsEditing(false);
  };

  const handleRandomizeAvatar = () => {
    const randomId = Math.floor(Math.random() * 1000);
    setAvatarUrl(`https://picsum.photos/id/${randomId}/200/200`);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[2000] flex flex-col animate-in slide-in-from-right duration-300">
       {/* Header */}
       <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-4 bg-white sticky top-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        
        {/* Profile Card */}
        <div className="bg-white p-6 mb-6 shadow-sm">
            <div className="flex flex-col items-center">
                <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4">
                        <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                    </div>
                    {isEditing && (
                        <button 
                            onClick={handleRandomizeAvatar}
                            className="absolute bottom-4 right-0 bg-blue-600 text-white p-2 rounded-full shadow-md hover:bg-blue-700 transition-colors"
                        >
                            <Camera size={16} />
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="w-full max-w-xs flex flex-col gap-4 animate-in fade-in">
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            className="text-center text-2xl font-bold text-gray-800 border-b-2 border-blue-500 outline-none py-1 bg-transparent"
                            autoFocus
                        />
                         <div className="flex gap-2">
                             <button 
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                             >
                                <Save size={18} /> Save
                             </button>
                             <button 
                                onClick={() => setIsEditing(false)}
                                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                             >
                                Cancel
                             </button>
                         </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{username}</h3>
                        <p className="text-gray-500 text-sm mb-4">Sports Enthusiast</p>
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-blue-600 font-semibold text-sm hover:underline"
                        >
                            Edit Profile
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white shadow-sm border-t border-b border-gray-100">
            <MenuItem icon={<Shield size={20} />} label="Privacy & Security" />
            <MenuItem icon={<Bell size={20} />} label="Notifications" />
            <MenuItem icon={<HelpCircle size={20} />} label="Help & Support" />
        </div>

        <div className="mt-6 bg-white shadow-sm border-t border-b border-gray-100">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-4 px-6 py-4 text-red-600 hover:bg-red-50 transition-colors"
            >
                <LogOut size={20} />
                <span className="font-medium">Log Out</span>
            </button>
        </div>

        <div className="p-6 text-center text-xs text-gray-400">
            Version 1.0.0 • Sport Line Inc.
        </div>

      </div>
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-none transition-colors text-left">
        <div className="text-gray-400">{icon}</div>
        <span className="text-gray-700 font-medium">{label}</span>
    </button>
);

export default SettingsView;