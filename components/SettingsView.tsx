import React, { useState, useRef } from 'react';
import { User, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { Camera, ArrowLeft, LogOut, Shield, Bell, HelpCircle, ChevronRight, Loader2, UploadCloud } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
}

// Helper: Compress image and convert to Base64
// We use aggressive compression (200px, 0.5 quality) to ensure the string is small enough for Firestore.
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Aggressive resizing for Firestore storage
        const MAX_WIDTH = 200; 
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
             // White background (for transparent PNGs converted to JPEG)
             ctx.fillStyle = '#FFFFFF';
             ctx.fillRect(0, 0, width, height);
             ctx.drawImage(img, 0, 0, width, height);
             
             // Compress to JPEG with 0.5 quality (very small string size)
             const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
             resolve(dataUrl);
        } else {
            reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onClose, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit Mode State
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    username: user.username || '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    gender: user.gender || 'Prefer not to say',
    preferredSports: user.preferredSports || []
  });

  const handleSave = async () => {
    // 1. Validate
    if (!formData.displayName.trim() || !formData.username.trim()) {
        alert("Name and Username are required.");
        return;
    }

    setIsSaving(true);
    
    try {
        const currentUser = auth?.currentUser;
        if (!currentUser) throw new Error("No authenticated user");

        const updatedUser = {
            ...user,
            ...formData
        };

        // 2. FORCE UPDATE LOCAL STORAGE NOW (Instant Persistence)
        // This ensures that even if the network is slow or fails, the next reload has the new data.
        localStorage.setItem(`sportline_profile_${currentUser.uid}`, JSON.stringify(updatedUser));

        // 3. Optimistic Update (Update UI Immediately)
        onUpdateUser(updatedUser);
        
        // 4. Close the modal IMMEDIATELY (Do not wait for database)
        setIsEditing(false);

        // 5. Background Sync to Firestore (Fire and Forget)
        if (db) {
            const userRef = doc(db, 'users', currentUser.uid);
            // We purposely do NOT await this promise. We let it run in the background.
            // Firebase SDK handles the queueing and retrying if offline.
            updateDoc(userRef, {
                displayName: formData.displayName,
                username: formData.username,
                bio: formData.bio,
                gender: formData.gender,
                preferredSports: formData.preferredSports,
                avatarUrl: formData.avatarUrl
            }).catch((err) => {
                console.warn("Background cloud sync failed (local save is okay):", err);
            });
        }

    } catch (error: any) {
        console.error("Error saving profile:", error);
        alert(`Failed to save changes: ${error.message}`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to current user data
    setFormData({
        displayName: user.displayName || '',
        username: user.username || '',
        avatarUrl: user.avatarUrl || '',
        bio: user.bio || '',
        gender: user.gender || 'Prefer not to say',
        preferredSports: user.preferredSports || []
    });
    setIsEditing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        
        if (file.size > 10 * 1024 * 1024) {
            alert("File is too large.");
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file.");
            return;
        }

        setIsUploading(true);
        try {
            // Compress
            const base64Image = await compressImage(file);
            
            // Check size (must be under 1MB for Firestore, aiming for <100KB for speed)
            if (base64Image.length > 900000) { 
                 alert("Image is still too large after compression. Please try a different photo.");
                 setIsUploading(false);
                 return;
            }

            // Update local state immediately
            setFormData(prev => ({ ...prev, avatarUrl: base64Image }));
            
        } catch (error) {
            console.error("Image processing failed", error);
            alert("Failed to process image.");
        } finally {
            setIsUploading(false);
        }
    }
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
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

  // --- EDIT PROFILE VIEW ---
  if (isEditing) {
    return (
        <div className="fixed inset-0 bg-white z-[2000] flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <button 
                    onClick={handleCancel}
                    disabled={isSaving || isUploading}
                    className="text-base text-gray-500 font-medium hover:text-gray-800 transition-colors"
                >
                    Cancel
                </button>
                <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
                <button 
                    onClick={handleSave}
                    disabled={isSaving || isUploading}
                    className="text-base text-blue-600 font-bold hover:text-blue-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                    {isSaving && <Loader2 size={14} className="animate-spin" />}
                    Done
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-12">
                {/* Avatar Edit */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative group cursor-pointer" onClick={triggerFileInput}>
                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gray-100 shadow-md bg-gray-100">
                            <img src={formData.avatarUrl || 'https://via.placeholder.com/150'} alt="User Avatar" className="w-full h-full object-cover" />
                        </div>
                        
                        {/* Loading Overlay */}
                        {isUploading && (
                             <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                                 <Loader2 className="animate-spin text-white" size={32} />
                             </div>
                        )}

                        {/* Hover Overlay */}
                        {!isUploading && (
                            <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <UploadCloud className="text-white" size={32} />
                            </div>
                        )}

                        <button type="button" className="absolute bottom-0 right-0 bg-gray-900 text-white p-2 rounded-full border-2 border-white shadow-sm hover:bg-gray-700 transition-colors">
                            <Camera size={16} />
                        </button>
                        
                        {/* Hidden File Input */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                    <button 
                        onClick={triggerFileInput} 
                        className="text-xs text-blue-600 font-semibold mt-3 hover:underline"
                        disabled={isUploading}
                    >
                        {isUploading ? 'Processing...' : 'Change Profile Photo'}
                    </button>
                </div>

                <div className="space-y-6 max-w-lg mx-auto">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1 ml-1">Name</label>
                        <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                            className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="Your Display Name"
                        />
                    </div>

                    {/* Username */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1 ml-1">Username</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="username"
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1 ml-1">Bio</label>
                        <textarea
                            rows={3}
                            value={formData.bio}
                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                            className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                            placeholder="Write something about yourself..."
                        />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1 ml-1">Gender</label>
                        <div className="relative">
                            <select
                                value={formData.gender}
                                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                                className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                            >
                                <option value="Prefer not to say">Prefer not to say</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Non-binary</option>
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90" size={20} />
                        </div>
                    </div>

                    {/* Preferred Sports */}
                    <div>
                         <label className="block text-sm font-bold text-gray-800 mb-2 ml-1">Preferred Sports</label>
                         <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                             <div className="flex flex-wrap gap-2">
                                 {SPORTS_LIST.filter(s => s.type !== 'All').map((sport) => {
                                     const isSelected = formData.preferredSports.includes(sport.type);
                                     return (
                                         <button
                                             key={sport.type}
                                             onClick={() => toggleSport(sport.type)}
                                             className={`px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border
                                                 ${isSelected 
                                                     ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                                     : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                         >
                                             {sport.icon}
                                             {sport.label}
                                         </button>
                                     );
                                 })}
                             </div>
                             <p className="text-xs text-gray-400 mt-3 ml-1">Select the sports you are interested in.</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- SETTINGS / VIEW MODE ---
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
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-gray-100">
                    <img src={user.avatarUrl || 'https://via.placeholder.com/150'} alt="User Avatar" className="w-full h-full object-cover" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-0">{user.displayName || 'User'}</h3>
                <p className="text-gray-500 text-sm mb-2">@{user.username || 'username'}</p>
                
                {user.bio && (
                    <p className="text-gray-600 text-center text-sm max-w-xs mb-4 px-4 py-2 bg-gray-50 rounded-lg italic">
                        "{user.bio}"
                    </p>
                )}

                {user.preferredSports && user.preferredSports.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-4 max-w-xs">
                        {user.preferredSports.slice(0, 3).map(sport => (
                            <span key={sport} className="text-[10px] uppercase font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-md">
                                {sport}
                            </span>
                        ))}
                        {user.preferredSports.length > 3 && (
                            <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">
                                +{user.preferredSports.length - 3} more
                            </span>
                        )}
                    </div>
                )}

                <button 
                    onClick={() => setIsEditing(true)}
                    className="mt-2 px-6 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full shadow-sm hover:bg-gray-800 transition-colors"
                >
                    Edit Profile
                </button>
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
            Version 1.2.4 (Instant Save)
        </div>

      </div>
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-none transition-colors text-left">
        <div className="text-gray-400">{icon}</div>
        <span className="text-gray-700 font-medium">{label}</span>
        <ChevronRight size={16} className="ml-auto text-gray-300" />
    </button>
);

export default SettingsView;