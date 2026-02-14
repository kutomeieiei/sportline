import React, { useState } from 'react';
import { User, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { Camera, ArrowLeft, LogOut, Shield, Bell, HelpCircle, ChevronRight, BrainCircuit, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, onClose, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  
  // Edit Mode State
  const [formData, setFormData] = useState({
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    gender: user.gender,
    preferredSports: user.preferredSports || [],
    skillLevel: user.skillLevel || 'Intermediate',
    playStyle: user.playStyle || 'Casual'
  });

  const handleSave = () => {
    onUpdateUser({
        ...user,
        ...formData
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        gender: user.gender,
        preferredSports: user.preferredSports || [],
        skillLevel: user.skillLevel || 'Intermediate',
        playStyle: user.playStyle || 'Casual'
    });
    setIsEditing(false);
  };

  // --- AI PROFILE EXTRACTION (v2026 Spec) ---
  const handleAIExtract = async () => {
    if (!formData.bio.trim() || isAIProcessing) return;
    setIsAIProcessing(true);
    try {
      // Use direct API key reference from process.env.API_KEY as per Google GenAI guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        System: You are an expert sports profile analyzer.
        Parse the following text bio and extract structured sport data:
        - skill_level: (Beginner | Intermediate | Pro)
        - play_style: (Casual | Competitive)
        - sports: array of matching sport categories from [Football, Basketball, Badminton, Tennis, Running, Cycling, Yoga]
        
        Text: "${formData.bio}"
        
        Format: JSON { "skillLevel": "string", "playStyle": "string", "sports": ["string"] }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      setFormData(prev => ({
        ...prev,
        skillLevel: result.skillLevel || prev.skillLevel,
        playStyle: result.playStyle || prev.playStyle,
        preferredSports: result.sports && result.sports.length > 0 ? result.sports : prev.preferredSports
      }));
    } catch (e) {
      console.error("AI Extraction Error:", e);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const toggleSport = (sport: SportType) => {
    setFormData(prev => {
        const current = prev.preferredSports;
        if (current.includes(sport)) {
            return { ...prev, preferredSports: current.filter(s => s !== sport) };
        } else {
            return { ...prev, preferredSports: [...current, sport] };
        }
    });
  };

  if (isEditing) {
    return (
        <div className="fixed inset-0 bg-white z-[2000] flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <button onClick={handleCancel} className="text-gray-500 font-bold uppercase tracking-wider text-xs">Cancel</button>
                <h2 className="text-lg font-black tracking-tighter uppercase">Athlete Profile</h2>
                <button onClick={handleSave} className="text-blue-600 font-black uppercase tracking-wider text-xs">Save</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
                <div className="flex flex-col items-center mb-10">
                    <div className="relative group cursor-pointer" onClick={() => setFormData(p => ({...p, avatarUrl: `https://picsum.photos/seed/${Date.now()}/200/200`}))}>
                        <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl rotate-3 transform">
                            <img src={formData.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-gray-900 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                            <Camera size={16} />
                        </div>
                    </div>
                </div>

                <div className="space-y-8 max-w-lg mx-auto">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Display Name</label>
                        <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Athlete Bio</label>
                             <button 
                                type="button"
                                onClick={handleAIExtract}
                                disabled={isAIProcessing || !formData.bio.trim()}
                                className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all
                                    ${isAIProcessing ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                             >
                                <BrainCircuit size={12} className={isAIProcessing ? 'animate-pulse' : ''} />
                                {isAIProcessing ? 'Analyzing...' : 'Auto-Extract (Gemini)'}
                             </button>
                        </div>
                        <textarea
                            rows={4}
                            value={formData.bio}
                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
                            placeholder="Tell Gemini about your play style, skill level, and location..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skill Level</label>
                            <select
                                value={formData.skillLevel}
                                onChange={(e) => setFormData({...formData, skillLevel: e.target.value as any})}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none appearance-none"
                            >
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Pro">Pro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Play Style</label>
                            <select
                                value={formData.playStyle}
                                onChange={(e) => setFormData({...formData, playStyle: e.target.value as any})}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none appearance-none"
                            >
                                <option value="Casual">Casual</option>
                                <option value="Competitive">Competitive</option>
                            </select>
                        </div>
                    </div>

                    <div>
                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Sports Intent</label>
                         <div className="grid grid-cols-2 gap-2">
                             {SPORTS_LIST.filter(s => s.type !== 'All').map((sport) => {
                                 const isSelected = formData.preferredSports.includes(sport.type);
                                 return (
                                     <button
                                         key={sport.type}
                                         type="button"
                                         onClick={() => toggleSport(sport.type)}
                                         className={`p-3 rounded-2xl text-xs font-black flex items-center gap-3 transition-all border uppercase tracking-wider
                                             ${isSelected 
                                                 ? 'bg-blue-600 text-white border-blue-600 shadow-lg' 
                                                 : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                     >
                                         <div className="scale-75">{sport.icon}</div>
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

  return (
    <div className="fixed inset-0 bg-gray-50 z-[2000] flex flex-col animate-in slide-in-from-right duration-300">
       <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-900" />
        </button>
        <h2 className="text-xl font-black uppercase tracking-tighter">Athletic Profile</h2>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="bg-white p-8 mb-4 shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl mb-6 transform rotate-3">
                <img src={user.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
            </div>
            
            <h3 className="text-2xl font-black text-gray-900 mb-1">{user.displayName}</h3>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-6">@{user.username}</p>
            
            <div className="flex gap-2 mb-8">
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                    {user.skillLevel || 'Intermediate'}
                </div>
                <div className="px-4 py-2 bg-pink-50 text-pink-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-pink-100">
                    {user.playStyle || 'Casual'}
                </div>
            </div>

            <button 
                onClick={() => setIsEditing(true)}
                className="w-full max-w-xs py-4 bg-gray-900 text-white text-sm font-black rounded-3xl shadow-xl hover:bg-black transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
                <Sparkles size={16} />
                Edit Athlete Profile
            </button>
        </div>

        <div className="bg-white shadow-sm border-y border-gray-100">
            <MenuItem icon={<Shield size={20} />} label="Security Protocols" />
            <MenuItem icon={<Bell size={20} />} label="Contextual Notifications" />
            <MenuItem icon={<HelpCircle size={20} />} label="AI Concierge Help" />
        </div>

        <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-8 py-6 text-red-600 font-black uppercase tracking-widest text-xs hover:bg-red-50 transition-colors mt-4 bg-white border-y border-gray-100"
        >
            <LogOut size={20} />
            Termination Session
        </button>

        <div className="p-10 text-center text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-30">
            Sportline v2026 Concierge • Private Cloud
        </div>
      </div>
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <button className="w-full flex items-center gap-4 px-8 py-5 hover:bg-gray-50 border-b border-gray-50 last:border-none transition-colors text-left">
        <div className="text-gray-400">{icon}</div>
        <span className="text-gray-800 font-bold text-sm">{label}</span>
        <ChevronRight size={16} className="ml-auto text-gray-300" />
    </button>
);

export default SettingsView;