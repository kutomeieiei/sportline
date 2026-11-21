import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase'; // Import db from firebase
import { Plus, Check, Users, Camera, UserPlus } from 'lucide-react';
import { User } from '../types'; // Import User type
import { resizeImageToDataUrl, fallbackAvatar } from '../utils/image';
import { recordMessage } from '../services/chatMeta';

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
  lastMessage?: { text: string; timestamp: any; senderId?: string };
  unreadCount?: number;
  sortTime?: number;
}

interface ChatListViewProps {
  friends: User[];
  friendRequests: User[];
  currentUser: User;
  onAddFriend: (username: string) => void;
  onAcceptFriend: (uid: string) => void;
  onRejectFriend: (uid: string) => void;
  onSelectChat: (user: ChatUser) => void;
}

const ChatListView: React.FC<ChatListViewProps> = ({ 
  friends, 
  friendRequests, 
  currentUser,
  onAddFriend, 
  onAcceptFriend, 
  onRejectFriend, 
  onSelectChat 
}) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups' | 'requests'>('friends');
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [allChats, setAllChats] = useState<ChatUser[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 15MB.");
      return;
    }
    try {
      setGroupAvatarUrl(await resizeImageToDataUrl(file, 256));
    } catch (err) {
      alert((err as Error).message || "Could not use this image.");
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (today.getTime() === msgDate.getTime()) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (yesterday.getTime() === msgDate.getTime()) {
        return 'Yesterday';
      }

      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return '';
    }
  };

  const handleAddFriendClick = () => {
    if (addFriendUsername.trim()) {
      onAddFriend(addFriendUsername.trim());
      setAddFriendUsername('');
    }
  };



  // Profiles of people I have direct chats with (cached so the list doesn't flicker).
  const [dmProfiles, setDmProfiles] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!currentUser.uid || !db) return;

    return db.collection('chats')
      .where('members', 'array-contains', currentUser.uid)
      .onSnapshot((snapshot) => {
        const chats: ChatUser[] = [];
        snapshot.docs.forEach((doc) => {
          const chatData = doc.data();
          // lastMessage is an object {text, senderId, timestamp}; party chats made by
          // older versions stored a plain string.
          const lm = chatData.lastMessage;
          const lastMessage = lm && typeof lm === 'object'
            ? { text: lm.text || '', timestamp: lm.timestamp, senderId: lm.senderId }
            : (typeof lm === 'string' ? { text: lm, timestamp: chatData.lastMessageTimestamp || chatData.createdAt } : undefined);
          const unreadCount = Number(chatData.unread?.[currentUser.uid] || 0);
          const ts = lastMessage?.timestamp || chatData.createdAt;
          const sortTime = ts?.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : 0);

          if (chatData.isGroup) {
            chats.push({
              id: doc.id,
              name: chatData.name || 'Group Chat',
              avatarUrl: chatData.avatarUrl || fallbackAvatar(chatData.name || 'Group'),
              isGroup: true,
              members: (chatData.members || []).length,
              lastMessage,
              unreadCount,
              sortTime,
            });
          } else {
            const otherUserId = (chatData.members || []).find((m: string) => m !== currentUser.uid);
            if (!otherUserId) return;
            chats.push({ id: otherUserId, name: '', avatarUrl: '', isGroup: false, lastMessage, unreadCount, sortTime });
          }
        });
        setAllChats(chats);
      }, (err) => console.error('Chat list listener failed', err));
  }, [currentUser.uid]);

  // Load names/photos for direct chats with people who aren't in my friends list.
  useEffect(() => {
    const known = new Set(friends.map((f) => f.uid));
    const missing = allChats.filter((c) => !c.isGroup && !known.has(c.id) && !dmProfiles[c.id]).map((c) => c.id);
    if (missing.length === 0) return;
    Promise.all(missing.map((uid) => db.collection('users').doc(uid).get())).then((docs) => {
      const add: Record<string, User> = {};
      docs.forEach((d) => { if (d.exists) add[d.id] = { uid: d.id, ...d.data() } as User; });
      setDmProfiles((prev) => ({ ...prev, ...add }));
    }).catch(() => {});
  }, [allChats, friends, dmProfiles]);

  const friendChats = allChats.filter(c => !c.isGroup);
  const byNewest = (a: ChatUser, b: ChatUser) => (b.sortTime || 0) - (a.sortTime || 0);
  const groupChats = allChats.filter(c => c.isGroup).sort(byNewest);

  const friendChatsMap = new Map(friendChats.map(c => [c.id, c]));

  const friendsList: ChatUser[] = friends
    .filter(f => f.uid)
    .map(f => {
      const chatInfo = friendChatsMap.get(f.uid);
      const name = f.display_name || f.displayName || 'Unknown';
      return {
        id: f.uid,
        name,
        avatarUrl: f.profile_img_url || f.avatarUrl || fallbackAvatar(name),
        isOnline: f.isOnline,
        lastMessage: chatInfo?.lastMessage,
        unreadCount: chatInfo?.unreadCount || 0,
        sortTime: chatInfo?.sortTime || 0,
        isGroup: false,
      };
    });
  // People who messaged me but aren't (or are no longer) my friends still show up.
  const friendIds = new Set(friendsList.map((f) => f.id));
  friendChats.filter((c) => !friendIds.has(c.id) && c.lastMessage).forEach((c) => {
    const p = dmProfiles[c.id];
    const name = p ? (p.display_name || p.displayName || p.username || 'Player') : '…';
    friendsList.push({ ...c, name, avatarUrl: p ? (p.profile_img_url || p.avatarUrl || fallbackAvatar(name)) : fallbackAvatar(name) });
  });
  friendsList.sort(byNewest);

  const friendsUnread = friendsList.reduce((n, c) => n + (c.unreadCount || 0), 0);
  const groupsUnread = groupChats.reduce((n, c) => n + (c.unreadCount || 0), 0);

  const requestChats: ChatUser[] = friendRequests
    .filter(f => f.uid)
    .map(f => ({
      id: f.uid,
      name: f.display_name || f.displayName || 'Unknown',
      avatarUrl: f.profile_img_url || f.avatarUrl || fallbackAvatar(f.display_name || f.displayName),
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

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedIds.length === 0 || !currentUser.uid) return;

    try {
      const members = [...selectedIds, currentUser.uid];
      const newGroupData = {
        name: groupName.trim().slice(0, 50),
        isGroup: true,
        members,
        createdAt: new Date(),
        avatarUrl: groupAvatarUrl.trim() || fallbackAvatar(groupName.trim())
      };

      const docRef = await db.collection('chats').add(newGroupData);
      
      // Add an initial message
      const text = `${currentUser.display_name || currentUser.displayName || 'Someone'} created the group.`;
      await docRef.collection('messages').add({
        text,
        senderId: currentUser.uid,
        timestamp: new Date(),
        type: 'system'
      });
      await recordMessage(docRef.id, members, currentUser.uid, 'system', text).catch(() => {});

      setIsCreatingGroup(false);
      setGroupName('');
      setGroupAvatarUrl('');
      setSelectedIds([]);
      setActiveTab('groups');
      
      // Optionally select the new chat immediately
      // onSelectChat({ id: docRef.id, name: newGroupData.name, avatarUrl: newGroupData.avatarUrl, isGroup: true });
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Failed to create group.");
    }
  };

  const filteredChats = activeTab === 'friends' ? friendsList : (activeTab === 'groups' ? groupChats : requestChats);

  // Friends list for group creation
  const contacts = friends
    .filter(f => f.uid)
    .map(f => ({ 
      id: f.uid, 
      name: f.display_name || f.displayName || 'Unknown', 
      avatarUrl: f.profile_img_url || f.avatarUrl || 'https://i.pravatar.cc/150' 
    })) as ChatUser[];

  if (isCreatingGroup) {
    return (
        <div className="w-full h-full bg-zinc-950 flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
            {/* Create Group Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <button onClick={() => setIsCreatingGroup(false)} className="text-zinc-400 hover:text-white font-medium transition-colors active:scale-95">
                    Cancel
                </button>
                <h2 className="text-lg font-bold text-white tracking-tight">New Group</h2>
                <button 
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selectedIds.length === 0}
                    className={`font-bold transition-colors active:scale-95 ${!groupName.trim() || selectedIds.length === 0 ? 'text-zinc-600' : 'text-red-500 hover:text-red-400'}`}
                >
                    Create
                </button>
            </div>

            <div className="p-6 bg-zinc-950 border-b border-zinc-800 space-y-4">
                <div className="flex items-center gap-4">
                     <div 
                        className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center text-red-500 border border-red-900/50 shadow-sm shrink-0 overflow-hidden relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                     >
                        {groupAvatarUrl ? (
                            <img src={groupAvatarUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                        ) : groupName ? (
                             <span className="text-xl font-bold">{groupName[0].toUpperCase()}</span>
                        ) : (
                             <Camera size={24} />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={20} className="text-white" />
                        </div>
                     </div>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        accept="image/*" 
                        className="hidden" 
                     />
                     <div className="flex-1 space-y-2">
                         <input 
                            type="text" 
                            placeholder="Group Name"
                            className="w-full text-lg font-semibold outline-none placeholder-zinc-500 bg-transparent text-white"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            autoFocus
                         />
                     </div>
                </div>
            </div>

            <div className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900 border-b border-zinc-800">
                Select Members ({selectedIds.length})
            </div>

            <div className="flex-1 overflow-y-auto bg-zinc-950">
                {contacts.map(contact => {
                    const isSelected = selectedIds.includes(contact.id);
                    return (
                        <button 
                            key={contact.id}
                            onClick={() => toggleSelection(contact.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-900 last:border-none active:scale-[0.98]"
                        >
                            <div className="relative">
                                <img src={contact.avatarUrl} className="w-12 h-12 rounded-full object-cover border border-zinc-800" />
                                {isSelected && (
                                    <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border-2 border-zinc-950 shadow-sm">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                )}
                            </div>
                            <span className="flex-1 text-left font-medium text-white text-base">{contact.name}</span>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-red-600 bg-red-600' : 'border-zinc-700'}`}>
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
    <div className="w-full h-full bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <div className="pt-4 pb-2 px-4 bg-zinc-950 sticky top-0 z-10 flex items-center justify-between">
         <h1 className="text-2xl font-bold text-white tracking-tight py-1">Chats</h1>
      </div>

      {/* Tabs */}
      <div className="flex px-4 border-b border-zinc-800 bg-zinc-950 sticky top-[60px] z-10">
        <button 
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 active:scale-95 ${
                activeTab === 'friends' 
                ? 'border-red-500 text-red-500' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
        >
            Friends
            {friendsUnread > 0 && (
                <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle font-bold shadow-sm">
                    {friendsUnread > 99 ? '99+' : friendsUnread}
                </span>
            )}
        </button>
        <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 active:scale-95 ${
                activeTab === 'groups' 
                ? 'border-red-500 text-red-500' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
        >
            Groups
            {groupsUnread > 0 && (
                <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle font-bold shadow-sm">
                    {groupsUnread > 99 ? '99+' : groupsUnread}
                </span>
            )}
        </button>
        <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-all border-b-2 active:scale-95 ${
                activeTab === 'requests' 
                ? 'border-red-500 text-red-500' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
        >
            Requests
            {friendRequests.length > 0 && (
                <span className="ml-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle font-bold shadow-sm">
                    {friendRequests.length}
                </span>
            )}
        </button>
      </div>

      {/* Add Friend Input */}
      {activeTab === 'friends' && (
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 sticky top-[108px] z-10">
            <div className="flex items-center gap-2 bg-zinc-900 rounded-xl p-1 border border-zinc-800 focus-within:border-red-500 transition-colors">
                <input 
                    type="text"
                    placeholder="Add friend by username or Gmail"
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-white placeholder-zinc-500"
                    value={addFriendUsername}
                    onChange={(e) => setAddFriendUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFriendClick()}
                />
                <button 
                    onClick={handleAddFriendClick}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors active:scale-95"
                    disabled={!addFriendUsername.trim()}
                >
                    <UserPlus size={18} />
                </button>
            </div>
        </div>
      )}

      {/* New Group (in the Groups tab) */}
      {activeTab === 'groups' && (
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 sticky top-[108px] z-10">
          <button
            onClick={() => setIsCreatingGroup(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 text-zinc-200 transition-colors active:scale-[0.98]"
          >
            <Plus size={20} className="text-red-500" />
            <span className="text-sm font-semibold">New Group</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col pb-24">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => activeTab !== 'requests' && onSelectChat(chat)}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-zinc-900 transition-colors w-full text-left border-b border-zinc-900/50 ${activeTab !== 'requests' ? 'active:scale-[0.98]' : 'cursor-default'}`}
              >
                {/* Avatar Container */}
                <div className="relative flex-shrink-0">
                  <div className={`w-[60px] h-[60px] rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 ${chat.isGroup ? 'p-1' : ''}`}>
                      <img src={chat.avatarUrl} alt={chat.name} className={`w-full h-full object-cover ${chat.isGroup ? 'rounded-full' : ''}`} />
                  </div>
                  
                  {/* Online Status Dot */}
                  {chat.isOnline && !chat.isGroup && activeTab !== 'requests' && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-zinc-950 rounded-full"></div>
                  )}
                  
                  {/* Group Icon Indicator */}
                  {chat.isGroup && (
                     <div className="absolute bottom-0 right-0 bg-zinc-800 rounded-full p-1 shadow-sm border border-zinc-700">
                          <Users size={12} className="text-red-500 fill-red-900/50" />
                     </div>
                  )}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-1">
                      <h3 className={`text-[17px] text-white truncate leading-tight ${chat.unreadCount ? 'font-bold' : 'font-semibold'}`}>
                          {chat.name}
                      </h3>
                      {chat.lastMessage?.timestamp && activeTab !== 'requests' && (
                          <span className={`text-[12px] font-normal ml-2 flex-shrink-0 ${chat.unreadCount ? 'text-red-500 font-semibold' : 'text-zinc-500'}`}>{formatTimestamp(chat.lastMessage.timestamp)}</span>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-[15px] text-zinc-400 font-light leading-tight">
                    <span className={`flex-1 truncate ${chat.unreadCount ? 'font-semibold text-white' : ''}`}>
                      {chat.lastMessage
                        ? `${chat.lastMessage.senderId === currentUser.uid ? 'You: ' : ''}${chat.lastMessage.text}`
                        : (chat.statusText || (activeTab === 'friends' ? 'Say hi 👋' : ''))}
                    </span>
                    {!!chat.unreadCount && activeTab !== 'requests' && (
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-red-900/50">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
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
                            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-sm"
                            title="Accept"
                        >
                            <Check size={18} strokeWidth={3} />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onRejectFriend(chat.id);
                            }}
                            className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:bg-zinc-700 transition-colors"
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
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 mb-4 border border-zinc-800">
                    {activeTab === 'friends' ? <Users size={32} /> : <Users size={32} />}
                </div>
                <p className="text-zinc-500 font-medium">No {activeTab} yet</p>
                {activeTab === 'groups' && (
                    <button 
                        onClick={() => setIsCreatingGroup(true)}
                        className="mt-4 text-red-500 font-bold text-sm hover:text-red-400 active:scale-95 transition-transform"
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