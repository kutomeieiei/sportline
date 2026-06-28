import React, { useState, useRef, useEffect } from 'react';
import { User, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { Camera, ArrowLeft, LogOut, Shield, Bell, HelpCircle, ChevronRight, Loader2, Mail, Database, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { db, auth, firebase } from '../firebase';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
  onOpenVenueAdmin: () => void;
  onOpenSportAdmin: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onClose, onLogout, onOpenVenueAdmin, onOpenSportAdmin }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<User>(user);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setFormData(user);
    }
  }, [isEditing, user]);

  // Image Processing Helper
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData(prev => ({ ...prev, profile_img_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // 1. Validation
    if (!formData.display_name?.trim()) {
      alert("Display Name is required");
      return;
    }
    if (!formData.username?.trim()) {
      alert("Username is required");
      return;
    }

    setIsSaving(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You are not currently signed in.");
      }

      // 2. Prepare Data (Clean undefined values)
      const userDataToSave = {
        display_name: formData.display_name || "",
        username: formData.username || "",
        email: formData.email || "", 
        bio: formData.bio || "",
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
      onUpdateUser(formData); // Update local state

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

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Testing Read/Write... (10s timeout)');
    
    try {
        if (!auth.currentUser) throw new Error("Not logged in");
        if (!navigator.onLine) throw new Error("You appear to be offline.");

        // TIMEOUT WRAPPER
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT: Database did not respond.")), 10000)
        );

        // Step 1: Test READ (usually faster)
        // We read a non-existent doc just to see if we can reach the server
        const readPromise = db.collection('connection_test').doc('ping').get();
        await Promise.race([readPromise, timeoutPromise]);

        // Step 2: Test WRITE
        const writePromise = db.collection('connection_test').add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            uid: auth.currentUser.uid,
            test: true,
            platform: navigator.userAgent
        });

        await Promise.race([writePromise, timeoutPromise]);

        setTestStatus('success');
        setTestMessage('Success! Read & Write operational.');
    } catch (error: unknown) {
        console.error("Connection Test Failed:", error);
        setTestStatus('error');
        
        const err = error as { code?: string; message?: string };

        if (err.message && err.message.includes("TIMEOUT")) {
            setTestMessage("TIMEOUT: Firewall blocking connection. Try 'Reset Cache'.");
        } else if (err.code === 'permission-denied') {
            setTestMessage('PERMISSION DENIED: Update Firestore Rules in Console.');
        } else if (err.code === 'unavailable' || (err.message && err.message.includes("offline"))) {
            setTestMessage('OFFLINE: Check your internet connection.');
        } else {
            setTestMessage(`ERROR: ${err.message || 'Unknown error'}`);
        }
    }
  };

  const handleResetCache = async () => {
      if (!confirm("This will refresh the app and clear local database data. Continue?")) return;
      
      try {
          // Terminate connection and clear persistence
          await db.terminate();
          await db.clearPersistence();
          window.location.reload();
      } catch (e: unknown) {
          const err = e as { message?: string };
          alert("Error resetting cache: " + (err.message || 'Unknown error'));
          window.location.reload(); // Reload anyway
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
      <div className="fixed inset-0 bg-zinc-950 z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Edit Header */}
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <button 
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            className="text-zinc-400 font-medium hover:text-white"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-white tracking-tight">Edit Profile</h2>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="text-red-500 font-bold hover:text-red-400 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Save'}
          </button>
        </div>


        <div className="flex-1 overflow-y-auto p-6 pb-24">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div 
              className="relative w-28 h-28 rounded-full overflow-hidden bg-zinc-800 border-4 border-zinc-700 shadow-sm cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <img 
                src={formData.profile_img_url || 'https://via.placeholder.com/150'} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                 <Camera className="text-white" size={32} />
              </div>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 text-sm font-semibold text-red-500 hover:text-red-400 transition-colors"
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

          {/* Form Fields */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-1">Display Name</label>
              <input 
                type="text"
                value={formData.display_name}
                onChange={e => setFormData({...formData, display_name: e.target.value})}
                className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl font-medium outline-none focus:bg-zinc-800 focus:border-red-500 transition-all text-white placeholder-zinc-500"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-1">Username</label>
              <input 
                type="text"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl font-medium outline-none focus:bg-zinc-800 focus:border-red-500 transition-all text-white placeholder-zinc-500"
                placeholder="Username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-1">Email</label>
              <input 
                type="email"
                value={formData.email || ''}
                disabled
                className="w-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl font-medium outline-none text-zinc-500 cursor-not-allowed"
              />
              <p className="text-xs text-zinc-500 mt-1 ml-1">Email cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-1">Bio</label>
              <textarea 
                rows={3}
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl font-medium outline-none focus:bg-zinc-800 focus:border-red-500 transition-all resize-none text-white placeholder-zinc-500"
                placeholder="About you..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-1">Gender</label>
              <div className="relative">
                <select 
                  value={formData.gender}
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                  className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl font-medium outline-none focus:bg-zinc-800 focus:border-red-500 appearance-none text-white"
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
              <label className="block text-sm font-bold text-zinc-300 mb-2">Sports Interests</label>
              <div className="flex flex-wrap gap-2">
                {SPORTS_LIST.filter(s => s.type !== 'All').map(sport => {
                  const isSelected = formData.preferred_sports?.includes(sport.type);
                  return (
                    <button
                      key={sport.type}
                      onClick={() => toggleSport(sport.type)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-2 active:scale-95 ${
                        isSelected 
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/50' 
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
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
  return (
    <div className="fixed inset-0 bg-zinc-950 z-[2000] flex flex-col animate-in slide-in-from-right duration-300">
       <div className="px-4 py-4 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full active:scale-95 transition-transform">
          <ArrowLeft size={24} className="text-zinc-400 hover:text-white" />
        </button>
        <h2 className="text-xl font-bold text-white">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-zinc-900 p-8 mb-6 shadow-sm flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-800 shadow-lg mb-4 bg-zinc-800">
                <img src={user.profile_img_url || 'https://via.placeholder.com/150'} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white">{user.display_name}</h1>
            <p className="text-zinc-500">@{user.username}</p>
            {user.email && (
                 <div className="flex items-center gap-1.5 mt-1 text-zinc-400 text-sm">
                    <Mail size={12} />
                    <span>{user.email}</span>
                 </div>
            )}
            {user.bio && <p className="mt-4 text-zinc-400 text-sm italic">"{user.bio}"</p>}

            <button 
                onClick={() => setIsEditing(true)}
                className="mt-6 px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-full hover:bg-red-700 shadow-lg shadow-red-900/50 active:scale-95 transition-all"
            >
                Edit Profile
            </button>
        </div>

        <div className="bg-zinc-900 border-t border-b border-zinc-800 mb-6">
            <MenuButton icon={<Shield size={20} />} label="Privacy Policy" />
            <MenuButton icon={<Bell size={20} />} label="Notifications" />
            <MenuButton icon={<HelpCircle size={20} />} label="Support" />
        </div>

        <div className="px-6 mb-6">
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
                 <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                     <Database size={16} className="text-red-500" /> Admin Tools
                 </h3>
                 <button 
                    onClick={onOpenVenueAdmin}
                    className="w-full flex items-center justify-between p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 mb-2 active:scale-[0.98]"
                 >
                    <span className="font-medium text-sm text-zinc-300">Manage Sport Venues</span>
                    <ChevronRight size={16} className="text-zinc-500" />
                 </button>
                 <button 
                    onClick={onOpenSportAdmin}
                    className="w-full flex items-center justify-between p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 active:scale-[0.98]"
                 >
                    <span className="font-medium text-sm text-zinc-300">Manage Sport Markers</span>
                    <ChevronRight size={16} className="text-zinc-500" />
                 </button>
             </div>
        </div>

        {/* Diagnostic Tool */}
        <div className="px-6 mb-6">
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
                 <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                     <Database size={16} className="text-red-500" /> Connection Diagnostics
                 </h3>
                 <p className="text-xs text-zinc-500 mb-3">Troubleshoot database connectivity issues.</p>
                 
                 {testStatus !== 'idle' && (
                     <div className={`text-xs p-2 rounded-lg mb-3 ${
                         testStatus === 'success' ? 'bg-green-900/30 text-green-400 border border-green-900/50' :
                         testStatus === 'error' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                         'bg-zinc-800 text-zinc-300 border border-zinc-700'
                     }`}>
                         {testStatus === 'testing' && <Loader2 className="inline animate-spin mr-2 w-3 h-3" />}
                         {testStatus === 'success' && <CheckCircle className="inline mr-2 w-3 h-3" />}
                         {testStatus === 'error' && <AlertTriangle className="inline mr-2 w-3 h-3" />}
                         {testMessage}
                     </div>
                 )}

                 <div className="flex gap-2">
                     <button 
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className="flex-1 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-700 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                     >
                        <RefreshCw size={12} className={testStatus === 'testing' ? 'animate-spin' : ''} />
                        Test Connection
                     </button>
                     <button 
                        onClick={handleResetCache}
                        title="Clear local database cache and reload"
                        className="px-3 py-2 bg-red-900/20 border border-red-900/50 rounded-lg text-xs font-bold text-red-500 hover:bg-red-900/40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                     >
                        <Trash2 size={12} />
                        Reset Cache
                     </button>
                 </div>
             </div>
        </div>
        
        <div className="px-6 pb-6">
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-zinc-900 border border-zinc-800 text-red-500 hover:bg-zinc-800 transition-colors rounded-2xl font-bold active:scale-95"
            >
                <LogOut size={20} />
                <span>Log Out</span>
            </button>
        </div>
        
        <div className="p-4 text-center text-xs text-zinc-600">
            v3.0.1 (Simplified)
        </div>
      </div>
    </div>
  );
};

const MenuButton = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
    <button className="w-full flex items-center gap-4 px-6 py-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors text-left last:border-0 active:bg-zinc-800">
        <div className="text-zinc-500">{icon}</div>
        <span className="text-zinc-300 font-medium">{label}</span>
        <ChevronRight className="ml-auto text-zinc-600" size={16} />
    </button>
);

export default SettingsView;