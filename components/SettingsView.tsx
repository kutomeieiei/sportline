import React, { useState, useRef, useEffect } from 'react';
import { User, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { Camera, ArrowLeft, LogOut, Shield, Bell, HelpCircle, ChevronRight, Loader2, UploadCloud } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
}

// --- UTILS ---

// Robust Image Compressor
// Firestore has a 1MB limit per document. We target ~100KB for avatars to be safe.
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max 300x300 is plenty for an avatar
        const MAX_SIZE = 300; 
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Browser does not support canvas"));
            return;
        }

        // White background for transparent PNGs converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with 0.7 quality to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const SettingsView: React.FC<SettingsViewProps> = ({ user, onClose, onLogout }) => {
  // Mode: 'view' or 'edit'
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<User>(user);
  
  // UI Helpers
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when entering edit mode to ensure we have latest data
  useEffect(() => {
    if (isEditing) {
        setFormData(user);
    }
  }, [isEditing, user]);

  // --- HANDLERS ---

  const handleSave = async () => {
    // 1. Basic Validation
    if (!formData.displayName?.trim() || !formData.username?.trim()) {
        alert("Name and Username are required.");
        return;
    }

    setIsSaving(true);

    try {
        if (!auth.currentUser) throw new Error("You are not logged in.");
        if (!db) throw new Error("Database connection not established.");

        const userRef = doc(db, 'users', auth.currentUser.uid);

        // 2. Data Cleaning
        // Firestore throws errors if you send 'undefined'. We replace them with defaults.
        const cleanData = {
            displayName: formData.displayName || '',
            username: formData.username || '',
            bio: formData.bio || '',
            gender: formData.gender || 'Prefer not to say',
            preferredSports: formData.preferredSports || [],
            avatarUrl: formData.avatarUrl || ''
        };

        // 3. Standard Save
        console.log("Saving user data...", cleanData);
        await setDoc(userRef, cleanData, { merge: true });
        
        console.log("Save complete.");
        setIsEditing(false);

    } catch (error: any) {
        console.error("Save Error:", error);
        alert(`Failed to save: ${error.message}`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        
        // Quick size check (5MB limit for raw file)
        if (file.size > 5 * 1024 * 1024) {
            alert("Image is too large. Please choose an image under 5MB.");
            return;
        }

        try {
            const compressedBase64 = await processImage(file);
            setFormData(prev => ({ ...prev, avatarUrl: compressedBase64 }));
        } catch (error) {
            console.error("Image error:", error);
            alert("Failed to process image.");
        }
    }
  };

  const toggleSport = (sport: SportType) => {
    setFormData(prev => {
        const current = prev.preferredSports || [];
        if (current.includes(sport)) {
            return { ...prev, preferredSports: current.filter(s => s !== sport) };
        } else {
            return { ...prev, preferredSports: [...current, sport] };
        }
    });
  };

  // --- RENDER: EDIT MODE ---
  if (isEditing) {
    return (
        <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                <button 
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="text-gray-500 font-medium hover:text-gray-900"
                >
                    Cancel
                </button>
                <h2 className="text-lg font-bold">Edit Profile</h2>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-blue-600 font-bold hover:text-blue-700 min-w-[60px] flex justify-end"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Save'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-20">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-8">
                    <div 
                        className="relative w-28 h-28 rounded-full overflow-hidden bg-gray-100 border-4 border-gray-50 shadow-sm cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <img 
                            src={formData.avatarUrl || 'https://via.placeholder.com/150'} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Camera className="text-white" size={32} />
                        </div>
                    </div>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 text-sm font-semibold text-blue-600"
                    >
                        Change Photo
                    </button>
                    <input 
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                </div>

                {/* Fields */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Display Name</label>
                        <input 
                            type="text"
                            value={formData.displayName}
                            onChange={e => setFormData({...formData, displayName: e.target.value})}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
                        <input 
                            type="text"
                            value={formData.username}
                            onChange={e => setFormData({...formData, username: e.target.value})}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-blue-500 transition-all"
                            placeholder="username"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Bio</label>
                        <textarea 
                            rows={3}
                            value={formData.bio}
                            onChange={e => setFormData({...formData, bio: e.target.value})}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
                            placeholder="Tell us about yourself..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
                        <div className="relative">
                            <select 
                                value={formData.gender}
                                onChange={e => setFormData({...formData, gender: e.target.value})}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                            >
                                <option>Prefer not to say</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Non-binary</option>
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-400" size={20} />
                        </div>
                    </div>

                    <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2">Sports Interest</label>
                         <div className="flex flex-wrap gap-2">
                             {SPORTS_LIST.filter(s => s.type !== 'All').map(sport => {
                                 const isSelected = formData.preferredSports?.includes(sport.type);
                                 return (
                                     <button
                                         key={sport.type}
                                         onClick={() => toggleSport(sport.type)}
                                         className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-2 ${
                                             isSelected 
                                             ? 'bg-blue-600 text-white border-blue-600' 
                                             : 'bg-white text-gray-600 border-gray-200'
                                         }`}
                                     >
                                         {sport.icon}
                                         {sport.label}
                                     </button>
                                 );
                             })}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- RENDER: VIEW MODE ---
  return (
    <div className="fixed inset-0 bg-gray-50 z-[2000] flex flex-col animate-in slide-in-from-right duration-300">
       <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-4 bg-white sticky top-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white p-8 mb-6 shadow-sm flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-gray-100">
                <img src={user.avatarUrl || 'https://via.placeholder.com/150'} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
            <p className="text-gray-500">@{user.username}</p>
            
            {user.bio && (
                <p className="mt-4 text-gray-600 text-sm max-w-xs italic">"{user.bio}"</p>
            )}

            <button 
                onClick={() => setIsEditing(true)}
                className="mt-6 px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-colors"
            >
                Edit Profile
            </button>
        </div>

        <div className="bg-white border-t border-b border-gray-200">
            <MenuButton icon={<Shield size={20} />} label="Privacy" />
            <MenuButton icon={<Bell size={20} />} label="Notifications" />
            <MenuButton icon={<HelpCircle size={20} />} label="Help" />
            <button 
                onClick={onLogout}
                className="w-full flex items-center gap-4 px-6 py-4 text-red-600 hover:bg-red-50 transition-colors"
            >
                <LogOut size={20} />
                <span className="font-medium">Log Out</span>
            </button>
        </div>
        
        <div className="p-8 text-center text-xs text-gray-400">
            v2.0 (Stable Rewrite)
        </div>
      </div>
    </div>
  );
};

const MenuButton = ({ icon, label }: { icon: any, label: string }) => (
    <button className="w-full flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left">
        <div className="text-gray-400">{icon}</div>
        <span className="text-gray-700 font-medium">{label}</span>
        <ChevronRight className="ml-auto text-gray-300" size={16} />
    </button>
);

export default SettingsView;