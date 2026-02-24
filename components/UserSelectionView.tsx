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
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">Share Venue</h2>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <X size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
        {friends.length === 0 ? (
          <p className="text-center text-gray-500 py-16">You have no friends to share with.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-w-2xl mx-auto">
            {friends.map(friend => {
              const isSelected = selectedIds.includes(friend.uid);
              return (
                <li 
                  key={friend.uid} 
                  onClick={() => toggleSelection(friend.uid)}
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <img src={friend.avatarUrl} alt={friend.displayName} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                      <p className="font-bold text-gray-800">{friend.displayName}</p>
                      <p className="text-sm text-gray-500">@{friend.username}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-10">
        <button 
            onClick={handleShare}
            disabled={selectedIds.length === 0}
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-3 px-4 py-4 text-lg font-bold text-white bg-blue-600 border border-transparent rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
            <Send size={20} />
            Send to {selectedIds.length} {selectedIds.length === 1 ? 'friend' : 'friends'}
        </button>
      </div>
    </div>
  );
};

export default UserSelectionView;
