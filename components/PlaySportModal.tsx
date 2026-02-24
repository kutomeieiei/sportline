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
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Play Sport</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-50 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'share'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Share Location
          </button>
          <button
            onClick={() => setActiveTab('find')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'find'
                ? 'bg-white text-blue-600 shadow-sm'
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
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin size={32} className="text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Broadcast Your Location</h3>
                <p className="text-sm text-gray-500">Let others nearby know you're ready to play.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">What are you playing?</label>
                <div className="grid grid-cols-4 gap-2">
                  {SPORTS_LIST.filter(s => s.type !== 'All').map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedShareSport(sport.type)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                        selectedShareSport === sport.type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className={`mb-2 ${selectedShareSport === sport.type ? 'text-blue-500' : 'text-gray-500'}`}>
                        {sport.icon}
                      </div>
                      <span className={`text-[10px] font-bold text-center ${selectedShareSport === sport.type ? 'text-blue-700' : 'text-gray-600'}`}>
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
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg ${
                  isBroadcasting 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }`}
              >
                {isBroadcasting ? 'Stop Broadcasting' : 'Start Broadcasting'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Find Players Nearby</h3>
                <p className="text-sm text-gray-500">Discover people who are broadcasting their location.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Sport Type</label>
                <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
                  {SPORTS_LIST.map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedFindSport(sport.type)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 whitespace-nowrap transition-all flex-shrink-0 ${
                        selectedFindSport === sport.type
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
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
                  <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">{playerCount}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
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
                className="w-full py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
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
