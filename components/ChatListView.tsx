import React, { useState } from 'react';
import { Plus, Check, Users, Camera, UserPlus } from 'lucide-react';
import { User } from '../types'; // Import User type

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
  statusText?: string;
  timestamp?: string;
  isOnline?: boolean;
  isUnread?: boolean;
  isGroup?: boolean;
  members?: number;
}

interface ChatListViewProps {
  friends: User[];
  friendRequests: User[];
  onAddFriend: (username: string) => void;
  onAcceptFriend: (uid: string) => void;
  onRejectFriend: (uid: string) => void;
  onSelectChat: (user: ChatUser) => void;
}

const ChatListView: React.FC<ChatListViewProps> = ({ 
  friends, 
  friendRequests, 
  onAddFriend, 
  onAcceptFriend, 
  onRejectFriend, 
  onSelectChat 
}) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups' | 'requests'>('friends');
  const [addFriendUsername, setAddFriendUsername] = useState('');

  const handleAddFriendClick = () => {
    if (addFriendUsername.trim()) {
      onAddFriend(addFriendUsername.trim());
      setAddFriendUsername('');
    }
  };

  // Convert friends to ChatUser for display
  const friendChats: ChatUser[] = friends
    .filter(f => f.uid)
    .map(f => ({
      id: f.uid,
      name: f.displayName,
      avatarUrl: f.avatarUrl,
      statusText: f.isOnline ? 'Online' : 'Offline',
      isOnline: f.isOnline,
    }));

  // Mock groups for now
  const groupChats: ChatUser[] = [];

  const requestChats: ChatUser[] = friendRequests
    .filter(f => f.uid)
    .map(f => ({
      id: f.uid,
      name: f.displayName,
      avatarUrl: f.avatarUrl,
      statusText: 'Sent you a friend request',
      isOnline: false,
    }));

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateGroup = () => {
    // This part remains for group creation logic, but we won't show any initial groups
  };

  const filteredChats = activeTab === 'friends' ? friendChats : (activeTab === 'groups' ? groupChats : requestChats);

  // Friends list for group creation
  const contacts = friends
    .filter(f => f.uid)
    .map(f => ({ 
      id: f.uid, 
      name: f.displayName, 
      avatarUrl: f.avatarUrl 
    })) as ChatUser[];

  if (isCreatingGroup) {
    return (
        <div className="w-full h-full bg-white flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
            {/* Create Group Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <button onClick={() => setIsCreatingGroup(false)} className="text-gray-500 hover:text-gray-800 font-medium">
                    Cancel
                </button>
                <h2 className="text-lg font-bold">New Group</h2>
                <button 
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selectedIds.length === 0}
                    className={`font-bold transition-colors ${!groupName.trim() || selectedIds.length === 0 ? 'text-gray-300' : 'text-blue-600'}`}
                >
                    Create
                </button>
            </div>

            <div className="p-6 bg-white border-b border-gray-100">
                <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100 shadow-sm shrink-0">
                        {groupName ? (
                             <span className="text-xl font-bold">{groupName[0].toUpperCase()}</span>
                        ) : (
                             <Camera size={24} />
                        )}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Group Name"
                        className="flex-1 text-lg font-semibold outline-none placeholder-gray-400 bg-transparent"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        autoFocus
                     />
                </div>
            </div>

            <div className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                Select Members ({selectedIds.length})
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
                {contacts.map(contact => {
                    const isSelected = selectedIds.includes(contact.id);
                    return (
                        <button 
                            key={contact.id}
                            onClick={() => toggleSelection(contact.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none"
                        >
                            <div className="relative">
                                <img src={contact.avatarUrl} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                                {isSelected && (
                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                )}
                            </div>
                            <span className="flex-1 text-left font-medium text-gray-800 text-base">{contact.name}</span>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                {isSelected && <Check size={14} className="text-white" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
  }

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="pt-4 pb-2 px-4 bg-white sticky top-0 z-10 flex items-center justify-between">
         <h1 className="text-2xl font-bold text-black">Chats</h1>
         <button 
            onClick={() => setIsCreatingGroup(true)}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-2 px-3"
         >
            <Plus size={20} />
            <span className="text-sm font-semibold">New Group</span>
         </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 border-b border-gray-100 bg-white sticky top-[60px] z-10">
        <button 
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 ${
                activeTab === 'friends' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
            Friends
        </button>
        <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 ${
                activeTab === 'groups' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
            Groups
        </button>
        <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 ${
                activeTab === 'requests' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
            Requests
            {friendRequests.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle">
                    {friendRequests.length}
                </span>
            )}
        </button>
      </div>

      {/* Add Friend Input */}
      {activeTab === 'friends' && (
        <div className="p-4 bg-white border-b border-gray-100 sticky top-[108px] z-10">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <input 
                    type="text"
                    placeholder="Add friend by username"
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                    value={addFriendUsername}
                    onChange={(e) => setAddFriendUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFriendClick()}
                />
                <button 
                    onClick={handleAddFriendClick}
                    className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
                    disabled={!addFriendUsername.trim()}
                >
                    <UserPlus size={18} />
                </button>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col pb-24">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => activeTab !== 'requests' && onSelectChat(chat)}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors w-full text-left ${activeTab !== 'requests' ? 'active:bg-gray-100' : 'cursor-default'}`}
              >
                {/* Avatar Container */}
                <div className="relative flex-shrink-0">
                  <div className={`w-[60px] h-[60px] rounded-full overflow-hidden bg-gray-200 border border-gray-100 ${chat.isGroup ? 'p-1' : ''}`}>
                      <img src={chat.avatarUrl} alt={chat.name} className={`w-full h-full object-cover ${chat.isGroup ? 'rounded-full' : ''}`} />
                  </div>
                  
                  {/* Online Status Dot */}
                  {chat.isOnline && !chat.isGroup && activeTab !== 'requests' && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#31a24c] border-2 border-white rounded-full"></div>
                  )}
                  
                  {/* Group Icon Indicator */}
                  {chat.isGroup && (
                     <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-sm border border-gray-100">
                          <Users size={12} className="text-blue-500 fill-blue-50" />
                     </div>
                  )}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-[17px] font-semibold text-black truncate leading-tight">
                          {chat.name}
                      </h3>
                      {chat.timestamp && activeTab !== 'requests' && (
                          <span className="text-[12px] text-gray-400 font-normal ml-2 flex-shrink-0">{chat.timestamp}</span>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-[15px] text-gray-500 font-light truncate leading-tight">
                    <span className={`truncate ${chat.isUnread ? 'font-bold text-black' : ''}`}>{chat.statusText}</span>
                  </div>
                </div>

                {/* Action Buttons for Requests */}
                {activeTab === 'requests' && (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onAcceptFriend(chat.id);
                            }}
                            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm"
                            title="Accept"
                        >
                            <Check size={18} strokeWidth={3} />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onRejectFriend(chat.id);
                            }}
                            className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                            title="Reject"
                        >
                            <Plus size={18} className="rotate-45" />
                        </button>
                    </div>
                )}
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                    {activeTab === 'friends' ? <Users size={32} /> : <Users size={32} />}
                </div>
                <p className="text-gray-500 font-medium">No {activeTab} yet</p>
                {activeTab === 'groups' && (
                    <button 
                        onClick={() => setIsCreatingGroup(true)}
                        className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                    >
                        Create a Group
                    </button>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatListView;