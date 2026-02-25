import React from 'react';
import { Map, PlusCircle, Settings, MessageCircle } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: 'explore' | 'create' | 'settings' | 'chat') => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-white/20 pb-safe pt-2 px-4 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] z-[1000] flex justify-between items-end h-[72px]">
      
      <button 
        onClick={() => onChangeTab('explore')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out ${currentTab === 'explore' ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'explore' ? 'bg-blue-50' : ''}`}>
            <Map size={24} strokeWidth={currentTab === 'explore' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Explore</span>
      </button>

      <button 
        onClick={() => onChangeTab('chat')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out ${currentTab === 'chat' ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'chat' ? 'bg-blue-50' : ''}`}>
            <MessageCircle size={24} strokeWidth={currentTab === 'chat' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Chat</span>
      </button>

      <button 
        onClick={() => onChangeTab('create')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out ${currentTab === 'create' ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
      >
         <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'create' ? 'bg-blue-50' : ''}`}>
            <PlusCircle size={24} strokeWidth={currentTab === 'create' ? 2.5 : 2} />
         </div>
        <span className="text-[10px] font-semibold tracking-wide">Create</span>
      </button>

      <button 
        onClick={() => onChangeTab('settings')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out ${currentTab === 'settings' ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'settings' ? 'bg-blue-50' : ''}`}>
            <Settings size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Settings</span>
      </button>
      
    </div>
  );
};

export default BottomNav;