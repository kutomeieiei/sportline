import React from 'react';
import { X, MapPin, Activity } from 'lucide-react';
import { DiscoveryResult } from '../types';

interface DiscoveredUsersSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredUsers: DiscoveryResult[];
}

const DiscoveredUsersSidebar: React.FC<DiscoveredUsersSidebarProps> = ({ isOpen, onClose, discoveredUsers }) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[4000] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-zinc-950/95 backdrop-blur-xl shadow-2xl z-[4001] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-zinc-800 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white tracking-tight">Players Nearby</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors active:scale-95"
          >
            <X size={20} className="text-zinc-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {discoveredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
              <Activity size={48} className="text-red-500/50" />
              <p className="text-zinc-500 font-medium">No players found nearby.<br/>Try expanding your search.</p>
            </div>
          ) : (
            discoveredUsers.map((result) => {
              const user = result.user;
              const distanceKm = (result.precise_distance / 1000).toFixed(1);
              const displayName = user?.display_name || user?.displayName || user?.username || 'Unknown Player';
              const avatar = user?.profile_img_url || user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`;
              const broadcastedSport = result.location.sport;
              const preferredSports = user?.preferred_sports || (user as any)?.preferredSports || [];

              return (
                <div 
                  key={result.uid} 
                  className="bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-800 hover:border-red-900/50 hover:shadow-md hover:shadow-red-900/20 transition-all duration-300 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={avatar} 
                      alt={displayName} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-zinc-800"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate">{displayName}</h3>
                      <div className="flex items-center text-xs text-red-500 font-medium mt-0.5">
                        <MapPin size={12} className="mr-1" />
                        {distanceKm} km away
                      </div>
                    </div>
                  </div>

                  {broadcastedSport && broadcastedSport !== 'All' && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-500 font-medium">Looking for:</span>
                      <span className="px-2.5 py-1 bg-red-900/30 text-red-400 text-[10px] font-bold rounded-full border border-red-900/50">
                        {broadcastedSport}
                      </span>
                    </div>
                  )}

                  {(!broadcastedSport || broadcastedSport === 'All') && preferredSports.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {preferredSports.map((sport: string, idx: number) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded-full border border-zinc-700"
                        >
                          {sport}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default DiscoveredUsersSidebar;
