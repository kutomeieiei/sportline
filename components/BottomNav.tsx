import React from 'react';
import { Map, PlusCircle, Settings, Navigation } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onChangeTab: (tab: 'explore' | 'create' | 'settings') => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-[1000] flex justify-between items-end h-[72px]">
      
      <button 
        onClick={() => onChangeTab('explore')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-colors ${currentTab === 'explore' ? 'text-blue-600' : 'text-gray-500'}`}
      >
        <div className={`p-1 rounded-full ${currentTab === 'explore' ? 'bg-blue-50' : ''}`}>
            <Map size={24} strokeWidth={currentTab === 'explore' ? 2.5 : 2} />
        </div>
        <span className="text-xs font-medium">Explore</span>
      </button>

      <button 
        onClick={() => onChangeTab('create')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-colors ${currentTab === 'create' ? 'text-blue-600' : 'text-gray-500'}`}
      >
         <div className={`p-1 rounded-full ${currentTab === 'create' ? 'bg-blue-50' : ''}`}>
            <PlusCircle size={24} strokeWidth={currentTab === 'create' ? 2.5 : 2} />
         </div>
        <span className="text-xs font-medium">Create Party</span>
      </button>

      <button 
        onClick={() => onChangeTab('settings')}
        className={`flex flex-col items-center gap-1 pb-3 flex-1 transition-colors ${currentTab === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
      >
        <div className={`p-1 rounded-full ${currentTab === 'settings' ? 'bg-blue-50' : ''}`}>
            <Settings size={24} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
        </div>
        <span className="text-xs font-medium">Settings</span>
      </button>
      
    </div>
  );
};

export default BottomNav;
