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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Play Sport</h2>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-50/50 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 ${
              activeTab === 'share'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Share Location
          </button>
          <button
            onClick={() => setActiveTab('find')}
            className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all duration-300 ${
              activeTab === 'find'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700'
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
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <MapPin size={28} className="text-gray-700" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">Broadcast Your Location</h3>
                <p className="text-sm text-gray-500">Let others nearby know you're ready to play.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">What are you playing?</label>
                <div className="grid grid-cols-4 gap-2">
                  {SPORTS_LIST.filter(s => s.type !== 'All').map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedShareSport(sport.type)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 ${
                        selectedShareSport === sport.type
                          ? 'border-gray-900 bg-gray-900 text-white shadow-md scale-[1.02]'
                          : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div className={`mb-2 ${selectedShareSport === sport.type ? 'text-white' : 'text-gray-500'}`}>
                        {sport.icon}
                      </div>
                      <span className={`text-[10px] font-bold text-center ${selectedShareSport === sport.type ? 'text-white' : 'text-gray-600'}`}>
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
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 shadow-lg ${
                  isBroadcasting 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                    : 'bg-gray-900 hover:bg-black shadow-gray-900/20'
                }`}
              >
                {isBroadcasting ? 'Stop Broadcasting' : 'Start Broadcasting'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <Search size={28} className="text-gray-700" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">Find Players Nearby</h3>
                <p className="text-sm text-gray-500">Discover people who are broadcasting their location.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Sport Type</label>
                <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                  {SPORTS_LIST.map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedFindSport(sport.type)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-300 flex-shrink-0 ${
                        selectedFindSport === sport.type
                          ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
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
                  <label className="block text-sm font-semibold text-gray-700">Number of Players</label>
                  <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{playerCount}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onFindPlayers(selectedFindSport, playerCount);
                  onClose();
                }}
                className="w-full py-4 rounded-2xl font-bold text-white bg-gray-900 hover:bg-black transition-all duration-300 shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2"
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
