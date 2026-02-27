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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[4000] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-white/95 backdrop-blur-xl shadow-2xl z-[4001] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white/50">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Players Nearby</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {discoveredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
              <Activity size={48} className="text-gray-400" />
              <p className="text-gray-500 font-medium">No players found nearby.<br/>Try expanding your search.</p>
            </div>
          ) : (
            discoveredUsers.map((result) => {
              const user = result.user;
              const distanceKm = (result.precise_distance / 1000).toFixed(1);
              const displayName = user?.display_name || user?.displayName || user?.username || 'Unknown Player';
              const avatar = user?.profile_img_url || user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`;
              const sports = user?.preferred_sports || (user as any)?.preferredSports || (result.location.sport ? [result.location.sport] : []);

              return (
                <div 
                  key={result.uid} 
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={avatar} 
                      alt={displayName} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-blue-100"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{displayName}</h3>
                      <div className="flex items-center text-xs text-blue-600 font-medium mt-0.5">
                        <MapPin size={12} className="mr-1" />
                        {distanceKm} km away
                      </div>
                    </div>
                  </div>

                  {sports.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {sports.map((sport, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100"
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
