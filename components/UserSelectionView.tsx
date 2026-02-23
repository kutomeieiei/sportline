import React from 'react';
import { DiscoveryResult } from '../types';
import { X } from 'lucide-react';

interface UserSelectionViewProps {
  users: DiscoveryResult[];
  onSelectUser: (user: DiscoveryResult) => void;
  onClose: () => void;
}

const UserSelectionView: React.FC<UserSelectionViewProps> = ({ users, onSelectUser, onClose }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold">Share with a friend</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-center text-gray-500">No nearby users found.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {users.map(userResult => (
                <li key={userResult.uid} className="py-3 flex items-center justify-between">
                  <span className="font-medium">{userResult.user?.display_name || 'Unknown User'}</span>
                  <button 
                    onClick={() => onSelectUser(userResult)}
                    className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700"
                  >
                    Send
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSelectionView;
