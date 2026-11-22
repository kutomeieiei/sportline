import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { SPORTS_LIST } from '../constants';
import { SportType } from '../types';

interface PlaySportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFindPlayers: (sport: SportType, count: number) => void;
}

/** "Find Friends": search for people nearby who are sharing their location. */
const PlaySportModal: React.FC<PlaySportModalProps> = ({
  isOpen,
  onClose,
  onFindPlayers,
}) => {
  const [selectedFindSport, setSelectedFindSport] = useState<SportType>('All');
  const [playerCount, setPlayerCount] = useState<number>(4);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-in z-[3000] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-elev-3 sheet-up sm:animate-none" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-medium text-gray-900 tracking-tight">Find Friends</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors active:scale-95">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
                  <Search size={28} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">Find Players Nearby</h3>
                <p className="text-sm text-gray-600">Discover people who are broadcasting their location.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Sport Type</label>
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                  {SPORTS_LIST.map((sport) => (
                    <button
                      key={sport.type}
                      onClick={() => setSelectedFindSport(sport.type)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-300 flex-shrink-0 active:scale-95 ${
                        selectedFindSport === sport.type
                          ? 'border-red-500 bg-red-600 text-white shadow-md shadow-red-600/20'
                          : 'border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">{playerCount}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onFindPlayers(selectedFindSport, playerCount);
                  onClose();
                }}
                className="w-full py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all duration-300 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <Search size={20} />
                Search Now
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlaySportModal;
