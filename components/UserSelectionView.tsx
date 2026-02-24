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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[2000] animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800">Share Venue</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={22} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {friends.length === 0 ? (
            <p className="text-center text-gray-500 py-16">You have no friends to share with.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {friends.map(friend => {
                const isSelected = selectedIds.includes(friend.uid);
                return (
                  <li 
                    key={friend.uid} 
                    onClick={() => toggleSelection(friend.uid)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <img src={friend.avatarUrl} alt={friend.displayName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div className="flex-1">
                        <p className="font-bold text-gray-800 text-lg">{friend.displayName}</p>
                        <p className="text-sm text-gray-500">@{friend.username}</p>
                    </div>
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
            <button 
                onClick={handleShare}
                disabled={selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 text-lg font-bold text-white bg-blue-600 border border-transparent rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
                <Send size={20} />
                Send to {selectedIds.length} {selectedIds.length === 1 ? 'friend' : 'friends'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserSelectionView;
