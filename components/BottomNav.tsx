import React from 'react';
import { Map, PlusCircle, Settings, MessageCircle } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: 'explore' | 'create' | 'settings' | 'chat') => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-lg border-t border-zinc-800 pb-safe pt-2 px-4 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.5)] z-[1000] flex justify-between items-end h-[72px]">
      
      <button 
        onClick={() => onChangeTab('explore')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'explore' ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'explore' ? 'bg-red-500/10' : ''}`}>
            <Map size={24} strokeWidth={currentTab === 'explore' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Explore</span>
      </button>

      <button 
        onClick={() => onChangeTab('chat')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'chat' ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'chat' ? 'bg-red-500/10' : ''}`}>
            <MessageCircle size={24} strokeWidth={currentTab === 'chat' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Chat</span>
      </button>

      <button 
        onClick={() => onChangeTab('create')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'create' ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
         <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'create' ? 'bg-red-500/10' : ''}`}>
            <PlusCircle size={24} strokeWidth={currentTab === 'create' ? 2.5 : 2} />
         </div>
        <span className="text-[10px] font-semibold tracking-wide">Create</span>
      </button>

      <button 
        onClick={() => onChangeTab('settings')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-all duration-300 ease-in-out active:scale-95 ${currentTab === 'settings' ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${currentTab === 'settings' ? 'bg-red-500/10' : ''}`}>
            <Settings size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-semibold tracking-wide">Settings</span>
      </button>
      
    </div>
  );
};

export default BottomNav;