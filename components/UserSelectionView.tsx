import React, { useState } from 'react';
import { User } from '../types';
import { X, Check, Send } from 'lucide-react';

interface UserSelectionViewProps {
  friends: User[];
  onShare: (selectedIds: string[]) => void;
  onClose: () => void;
}

const UserSelectionView: React.FC<UserSelectionViewProps> = ({ friends, onShare, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleShare = () => {
    if (selectedIds.length > 0) {
      onShare(selectedIds);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shadow-sm">
        <h2 className="text-xl font-bold text-white tracking-tight">Share Venue</h2>
        <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors active:scale-95">
          <X size={20} className="text-zinc-400 hover:text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
        {friends.length === 0 ? (
          <p className="text-center text-zinc-500 py-16">You have no friends to share with.</p>
        ) : (
          <ul className="divide-y divide-zinc-800/50 max-w-2xl mx-auto">
            {friends.map(friend => {
              const isSelected = selectedIds.includes(friend.uid);
              return (
                <li 
                  key={friend.uid} 
                  onClick={() => toggleSelection(friend.uid)}
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-900 transition-colors active:scale-[0.98]"
                >
                  <img src={friend.profile_img_url || friend.avatarUrl || 'https://i.pravatar.cc/150'} alt={friend.displayName} className="w-12 h-12 rounded-full object-cover border border-zinc-800" />
                  <div className="flex-1">
                      <p className="font-bold text-white">{friend.displayName}</p>
                      <p className="text-sm text-zinc-500">@{friend.username}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-red-600 bg-red-600 shadow-sm shadow-red-900/50' : 'border-zinc-700 bg-zinc-900'}`}>
                      {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 pb-10">
        <button 
            onClick={handleShare}
            disabled={selectedIds.length === 0}
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-3 px-4 py-4 text-lg font-bold text-white bg-red-600 border border-transparent rounded-2xl shadow-lg shadow-red-900/20 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95"
        >
            <Send size={20} />
            Send to {selectedIds.length} {selectedIds.length === 1 ? 'friend' : 'friends'}
        </button>
      </div>
    </div>
  );
};

export default UserSelectionView;
