import React, { useState, useRef, useEffect } from 'react';
import { User, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { Camera, ArrowLeft, LogOut, Shield, HelpCircle, ChevronRight, Loader2, Mail, Database } from 'lucide-react';
import { db, auth } from '../firebase';
import { resizeImageToDataUrl, fallbackAvatar } from '../utils/image';
import CameraCapture from './CameraCapture';
import ConnectionDiagnostics from './ConnectionDiagnostics';
import PrivacyPolicyView from './PrivacyPolicyView';
import { usernameError, isUsernameTaken, normalizeUsername } from '../utils/username';

// Fill old/new field names so the form and profile always show something.
const withProfileDefaults = (u: User): User => ({
  ...u,
  display_name: u.display_name || u.displayName || '',
  profile_img_url: u.profile_img_url || u.avatarUrl || '',
  preferred_sports: u.preferred_sports || [],
  bio: u.bio || '',
  gender: u.gender || 'Prefer not to say',
});

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
  onOpenVenueAdmin: () => void;
  onOpenSportAdmin: () => void;
  isAdmin?: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onClose, onLogout, onOpenVenueAdmin, onOpenSportAdmin, isAdmin = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<User>(withProfileDefaults(user));
  const profile = withProfileDefaults(user);
  const avatarSrc = profile.profile_img_url || fallbackAvatar(profile.display_name);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleCameraPhoto = async (file: File) => {
    try {
      const resized = await resizeImageToDataUrl(file, 256);
      setFormData(prev => ({ ...prev, profile_img_url: resized }));
    } catch (err) {
      alert((err as Error).message || "Could not use this photo.");
    }
  };

  // Load the latest profile into the form only when editing starts,
  // so background updates don't wipe what the user is typing.
  useEffect(() => {
    if (isEditing) {
      setFormData(withProfileDefaults(user));
    }
  }, [isEditing]);

  // Image Processing Helper
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 15MB.");
      return;
    }

    try {
      // Shrink to a small square-ish photo so it always fits in the database.
      const resized = await resizeImageToDataUrl(file, 256);
      setFormData(prev => ({ ...prev, profile_img_url: resized }));
    } catch (err) {
      alert((err as Error).message || "Could not use this image.");
    }
  };

  const handleSave = async () => {
    // 1. Validation
    if (!formData.display_name?.trim()) {
      alert("Display Name is required");
      return;
    }
    if (formData.display_name.trim().length > 40) {
      alert("Display Name must be 40 characters or less");
      return;
    }
    const nameProblem = usernameError(formData.username || '');
    if (nameProblem) {
      alert(nameProblem);
      return;
    }
    if ((formData.bio || '').length > 200) {
      alert("Bio must be 200 characters or less");
      return;
    }

    setIsSaving(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You are not currently signed in.");
      }

      const newUsername = normalizeUsername(formData.username || '');
      if (newUsername !== user.username && await isUsernameTaken(newUsername, currentUser.uid)) {
        alert(`The username "${newUsername}" is already taken. Please choose another.`);
        setIsSaving(false);
        return;
      }

      // 2. Prepare Data (save both old and new field names so every screen shows it)
      const displayName = formData.display_name.trim();
      const userDataToSave = {
        display_name: displayName,
        displayName: displayName,
        username: newUsername,
        bio: (formData.bio || "").trim(),
        gender: formData.gender || "Prefer not to say",
        preferred_sports: formData.preferred_sports || [],
        profile_img_url: formData.profile_img_url || ""
      };

      // 3. Firestore Write
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("TIMEOUT: Save operation took too long.")), 10000)
      );
      
      await Promise.race([
        db.collection('users').doc(currentUser.uid).set(userDataToSave, { merge: true }),
        timeoutPromise
      ]);
      
      console.log("Profile updated successfully");
      setIsEditing(false);
      onUpdateUser({ ...formData, ...userDataToSave }); // Update local state

    } catch (error: unknown) {
      console.error("Save failed:", error);
      let errorMessage = "Failed to save profile.";
      
      const err = error as { code?: string; message?: string };

      if (err.code === 'permission-denied') {
        errorMessage = "Permission denied. Check Firestore Security Rules.";
      } else if (err.message && err.message.includes("TIMEOUT")) {
        errorMessage = "Connection Timed Out. Please check your internet.";
      } else if (err.code === 'unavailable') {
        errorMessage = "Network error. Please check your internet connection.";
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSport = (sport: SportType) => {
    setFormData(prev => {
      const current = prev.preferred_sports || [];
      if (current.includes(sport)) {
        return { ...prev, preferred_sports: current.filter(s => s !== sport) };
      } else {
        return { ...prev, preferred_sports: [...current, sport] };
      }
    });
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 md:left-20 bg-white z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Edit Header */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <button 
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            className="text-gray-600 font-medium hover:text-gray-900"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Edit Profile</h2>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="text-red-600 font-bold hover:text-red-700 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Save'}
          </button>
        </div>


        <div className="flex-1 overflow-y-auto p-6 pb-24">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative w-28 h-28 rounded-full overflow-hidden bg-gray-100 border-4 border-gray-200 shadow-sm cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <img 
                src={formData.profile_img_url || fallbackAvatar(formData.display_name)} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                 <Camera className="text-gray-900" size={32} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                Choose Photo
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={() => setIsCameraOpen(true)}
                className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
              >
                <Camera size={16} /> Take Photo
              </button>
            </div>
            {isCameraOpen && (
              <CameraCapture
                title="Profile photo"
                initialFacing="user"
                onCapture={handleCameraPhoto}
                onClose={() => setIsCameraOpen(false)}
              />
            )}
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Display Name</label>
              <input 
                type="text"
                value={formData.display_name}
                maxLength={40}
                onChange={e => setFormData({...formData, display_name: e.target.value})}
                className="w-full p-4 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-red-500 transition-all text-gray-900 placeholder-gray-400"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
              <input 
                type="text"
                value={formData.username}
                maxLength={20}
                autoCapitalize="none"
                onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                className="w-full p-4 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-red-500 transition-all text-gray-900 placeholder-gray-400"
                placeholder="Username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
              <input 
                type="email"
                value={formData.email || ''}
                disabled
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1 ml-1">Email cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Bio</label>
              <textarea 
                rows={3}
                value={formData.bio}
                maxLength={200}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                className="w-full p-4 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-red-500 transition-all resize-none text-gray-900 placeholder-gray-400"
                placeholder="About you..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
              <div className="relative">
                <select 
                  value={formData.gender}
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl font-medium outline-none focus:bg-white focus:border-red-500 appearance-none text-gray-900"
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Sports Interests</label>
              <div className="flex flex-wrap gap-2">
                {SPORTS_LIST.filter(s => s.type !== 'All').map(sport => {
                  const isSelected = formData.preferred_sports?.includes(sport.type);
                  return (
                    <button
                      key={sport.type}
                      onClick={() => toggleSport(sport.type)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-2 active:scale-95 ${
                        isSelected 
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/20' 
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
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

  // View Mode
  if (isPrivacyOpen) {
    return <PrivacyPolicyView onClose={() => setIsPrivacyOpen(false)} />;
  }

  return (
    <div className="fixed inset-0 md:left-20 bg-white z-[2000] flex flex-col animate-in slide-in-from-right duration-300">
       <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-4 bg-white/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full active:scale-95 transition-transform">
          <ArrowLeft size={24} className="text-gray-600 hover:text-gray-900" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white p-8 mb-6 shadow-sm flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg mb-4 bg-gray-100">
                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.display_name || 'Sports Fan'}</h1>
            <p className="text-gray-500">@{user.username}</p>
            {user.email && (
                 <div className="flex items-center gap-1.5 mt-1 text-gray-600 text-sm">
                    <Mail size={12} />
                    <span>{user.email}</span>
                 </div>
            )}
            {user.bio && <p className="mt-4 text-gray-600 text-sm italic">"{user.bio}"</p>}

            <button 
                onClick={() => setIsEditing(true)}
                className="ripple press mt-5 h-10 px-6 bg-white border border-gray-300 text-red-700 text-sm font-medium rounded-full hover:bg-red-50 hover:border-red-200"
            >
                Edit Profile
            </button>
        </div>

        <div className="bg-white border-t border-b border-gray-200 mb-6">
            <MenuButton icon={<Shield size={20} />} label="Privacy Policy" onClick={() => setIsPrivacyOpen(true)} />
            <MenuButton icon={<HelpCircle size={20} />} label="Support" />
        </div>

        {isAdmin && (
        <div className="px-6 mb-6">
             <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                 <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                     <Database size={16} className="text-red-600" /> Admin Tools
                 </h3>
                 <button 
                    onClick={onOpenVenueAdmin}
                    className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200 mb-2 active:scale-[0.98]"
                 >
                    <span className="font-medium text-sm text-gray-700">Manage Sport Venues</span>
                    <ChevronRight size={16} className="text-gray-500" />
                 </button>
                 <button 
                    onClick={onOpenSportAdmin}
                    className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200 active:scale-[0.98]"
                 >
                    <span className="font-medium text-sm text-gray-700">Manage Sport Markers</span>
                    <ChevronRight size={16} className="text-gray-500" />
                 </button>
             </div>
        </div>
        )}

        {/* Diagnostic Tool */}
        <div className="px-6 mb-6">
          <ConnectionDiagnostics />
        </div>

        <div className="px-6 pb-6">
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white border border-gray-200 text-red-600 hover:bg-gray-100 transition-colors rounded-2xl font-bold active:scale-95"
            >
                <LogOut size={20} />
                <span>Log Out</span>
            </button>
        </div>
        
        <div className="p-4 text-center text-xs text-gray-400">
            v3.0.1 (Simplified)
        </div>
      </div>
    </div>
  );
};

const MenuButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
    <button onClick={onClick} className="ripple w-full flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 text-left last:border-0">
        <div className="text-gray-500">{icon}</div>
        <span className="text-gray-700 font-medium">{label}</span>
        <ChevronRight className="ml-auto text-gray-400" size={16} />
    </button>
);

export default SettingsView;