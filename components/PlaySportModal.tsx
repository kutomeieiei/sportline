import React, { useState } from 'react';
import { X, MapPin, Search, Users, Activity } from 'lucide-react';
import { SPORTS_LIST } from '../constants';
import { SportType } from '../types';

interface PlaySportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBroadcasting: boolean;
  onToggleBroadcast: (sport: SportType) => void;
  onFindPlayers: (sport: SportType, count: number) => void;
  currentSport?: SportType;
}

const PlaySportModal: React.FC<PlaySportModalProps> = ({
  isOpen,
  onClose,
  isBroadcasting,
  onToggleBroadcast,
  onFindPlayers,
  currentSport = 'All'
}) => {
  const [activeTab, setActiveTab] = useState<'share' | 'find'>('share');
  const [selectedShareSport, setSelectedShareSport] = useState<SportType>(currentSport);
  const [selectedFindSport, setSelectedFindSport] = useState<SportType>('All');
  const [playerCount, setPlayerCount] = useState<number>(4);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white tracking-tight">Play Sport</h2>
          <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors active:scale-95">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-zinc-900/50 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 active:scale-95 ${
              activeTab === 'share'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Share Location
          </button>
          <button
            onClick={() => setActiveTab('find')}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 active:scale-95 ${
              activeTab === 'find'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Find Friends
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'share' ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                  <MapPin size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1 tracking-tight">Broadcast Your Location</h3>
                <p className="text-sm text-zinc-400">Let others nearby know you're ready to play.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">What are you playing?</label>
                <div className="grid grid-cols-4 gap-2">
                  {SPORTS_LIST.filter(s => s.type !== 'All').map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedShareSport(sport.type)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 active:scale-95 ${
                        selectedShareSport === sport.type
                          ? 'border-red-500 bg-red-600 text-white shadow-md shadow-red-900/50 scale-[1.02]'
                          : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600 hover:bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className={`mb-2 ${selectedShareSport === sport.type ? 'text-white' : 'text-zinc-500'}`}>
                        {sport.icon}
                      </div>
                      <span className={`text-[10px] font-bold text-center ${selectedShareSport === sport.type ? 'text-white' : 'text-zinc-400'}`}>
                        {sport.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  onToggleBroadcast(selectedShareSport);
                }}
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 shadow-lg active:scale-95 ${
                  isBroadcasting 
                    ? 'bg-zinc-700 hover:bg-zinc-600 shadow-black/50 border border-zinc-600' 
                    : 'bg-red-600 hover:bg-red-700 shadow-red-900/50'
                }`}
              >
                {isBroadcasting ? 'Stop Broadcasting' : 'Start Broadcasting'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                  <Search size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1 tracking-tight">Find Players Nearby</h3>
                <p className="text-sm text-zinc-400">Discover people who are broadcasting their location.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">Sport Type</label>
                <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                  {SPORTS_LIST.map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedFindSport(sport.type)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-300 flex-shrink-0 active:scale-95 ${
                        selectedFindSport === sport.type
                          ? 'border-red-500 bg-red-600 text-white shadow-md shadow-red-900/50'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {sport.icon}
                      <span className="font-bold text-sm">{sport.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-zinc-300">Number of Players</label>
                  <span className="text-sm font-bold text-red-400 bg-red-900/30 px-3 py-1 rounded-full border border-red-900/50">{playerCount}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-2 font-medium">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onFindPlayers(selectedFindSport, playerCount);
                  onClose();
                }}
                className="w-full py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all duration-300 shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-95"
              >
                <Search size={20} />
                Search Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaySportModal;
