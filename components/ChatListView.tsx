import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ArrowLeft, Search, SquarePen, UserPlus, X, Users } from 'lucide-react';
import { Party, User, Venue } from '../types';
import { fallbackAvatar } from '../utils/image';
import { timeAgoShort, toDate } from '../utils/time';
import PartyNotesRow from './PartyNotesRow';
import NewMessageSheet from './NewMessageSheet';
import Portal from './Portal';

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
  username?: string;
  /** I've used my one message to this (non-friend) person. */
  introByMe?: boolean;
}

interface ChatListViewProps {
  friends: User[];
  friendRequests: User[];
  currentUser: User;
  parties: Party[];
  /** Highlights the open chat (PC two-column layout). */
  selectedChatId?: string | null;
  isComposeOpen: boolean;
  onComposeOpenChange: (open: boolean) => void;
  onAddFriend: (usernameOrEmail: string) => void;
  onAcceptFriend: (uid: string) => void;
  onRejectFriend: (uid: string) => void;
  onSelectChat: (user: ChatUser) => void;
  onOpenParty: (party: Party) => void;
  onPlanParty: () => void;
  /** Open "new message" to make a group about this venue. */
  composeVenue?: Venue | null;
}

const nameOf = (u: User) => u.display_name || u.displayName || u.username || 'Player';

const ChatListView: React.FC<ChatListViewProps> = ({
  friends,
  friendRequests,
  currentUser,
  parties,
  selectedChatId,
  isComposeOpen,
  onComposeOpenChange,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  onSelectChat,
  onOpenParty,
  onPlanParty,
  composeVenue,
}) => {
  const [view, setView] = useState<'inbox' | 'requests'>('inbox');
  const [query, setQuery] = useState('');
  const [allChats, setAllChats] = useState<ChatUser[]>([]);
  // Profiles of people I have direct chats with who aren't friends (cached so the list doesn't flicker).
  const [dmProfiles, setDmProfiles] = useState<Record<string, User>>({});
  // Re-render every minute so "5m" ages.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

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
          const sortTime = toDate(ts)?.getTime() || 0;

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
            chats.push({
              id: otherUserId, name: '', avatarUrl: '', isGroup: false, lastMessage, unreadCount, sortTime,
              introByMe: !!chatData.intro?.[currentUser.uid],
            });
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

  // ---- One list: direct chats + group chats, newest first (friends never messaged go last).
  const directChats = new Map(allChats.filter((c) => !c.isGroup).map((c) => [c.id, c]));
  const conversations: ChatUser[] = friends.filter((f) => f.uid).map((f) => {
    const chat = directChats.get(f.uid);
    const name = nameOf(f);
    return {
      id: f.uid,
      name,
      username: f.username,
      avatarUrl: f.profile_img_url || f.avatarUrl || fallbackAvatar(name),
      isOnline: f.isOnline,
      lastMessage: chat?.lastMessage,
      unreadCount: chat?.unreadCount || 0,
      sortTime: chat?.sortTime || 0,
      isGroup: false,
    };
  });
  // Chats with people who aren't my friends:
  // - I messaged them first -> in my Messages (waiting for them)
  // - they messaged me and I haven't answered -> a message request (in Requests)
  const friendIds = new Set(conversations.map((c) => c.id));
  const messageRequests: ChatUser[] = [];
  directChats.forEach((c) => {
    if (friendIds.has(c.id) || !c.lastMessage) return;
    const p = dmProfiles[c.id];
    const name = p ? nameOf(p) : '…';
    const chat = { ...c, name, username: p?.username, avatarUrl: p ? (p.profile_img_url || p.avatarUrl || fallbackAvatar(name)) : fallbackAvatar(name) };
    if (c.introByMe) conversations.push(chat); else messageRequests.push(chat);
  });
  messageRequests.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  const requestCount = friendRequests.length + messageRequests.length;
  allChats.filter((c) => c.isGroup).forEach((g) => conversations.push(g));
  conversations.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

  const q = query.trim().toLowerCase();
  const shown = q
    ? conversations.filter((c) => c.name.toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q.replace(/^@/, '')))
    : conversations;
  const canAddFriend = q.length >= 3 && !conversations.some((c) => (c.username || '').toLowerCase() === q.replace(/^@/, ''));

  const subtitle = (c: ChatUser) => {
    if (!c.lastMessage) return c.isGroup ? `${c.members || 0} members` : 'Tap to chat';
    if ((c.unreadCount || 0) > 1) return `${c.unreadCount! > 4 ? '4+' : c.unreadCount} new messages`;
    const mine = c.lastMessage.senderId === currentUser.uid;
    return `${mine ? 'You: ' : ''}${c.lastMessage.text}`;
  };

  // ---------- Requests page ----------
  if (view === 'requests') {
    return (
      <div className="w-full h-full bg-white flex flex-col animate-in fade-in slide-in-from-right">
        <div className="flex items-center gap-2 h-16 px-2 border-b border-gray-200 shrink-0">
          <button onClick={() => setView('inbox')} aria-label="Back" className="ripple press w-10 h-10 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Requests</h1>
        </div>
        <p className="px-4 py-3 text-[13px] text-gray-500 border-b border-gray-100">
          People who aren't your friends can send you one message. Accept their friend request (or add them) to keep chatting.
        </p>
        <div className="flex-1 overflow-y-auto stagger">
          {requestCount === 0 && (
            <p className="px-4 py-16 text-center text-sm text-gray-500">No requests right now.</p>
          )}
          {messageRequests.length > 0 && <p className="px-4 pt-3 pb-1 text-sm font-semibold text-gray-900">Message requests</p>}
          {messageRequests.map((c) => (
            <button key={c.id} onClick={() => onSelectChat(c)} className="ripple w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
              <img src={c.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] text-gray-900 truncate ${c.unreadCount ? 'font-semibold' : ''}`}>{c.name}</span>
                <span className="block text-[13px] text-gray-500 truncate">{c.lastMessage?.text}</span>
              </span>
              {!!c.unreadCount && <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />}
            </button>
          ))}
          {friendRequests.length > 0 && <p className="px-4 pt-3 pb-1 text-sm font-semibold text-gray-900">Friend requests</p>}
          {friendRequests.filter((f) => f.uid).map((f) => {
            const name = nameOf(f);
            return (
              <div key={f.uid} className="flex items-center gap-3 px-4 py-2.5">
                <img src={f.profile_img_url || f.avatarUrl || fallbackAvatar(name)} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900 truncate">{name}</p>
                  {f.username && <p className="text-[13px] text-gray-500 truncate">@{f.username}</p>}
                </div>
                <button onClick={() => onAcceptFriend(f.uid)} className="ripple press h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Confirm</button>
                <button onClick={() => onRejectFriend(f.uid)} className="ripple press h-9 px-4 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200">Delete</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Inbox ----------
  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-16 pl-4 md:pl-5 pr-2 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 truncate">{currentUser.username ? currentUser.username : 'Chats'}</h1>
        <button
          onClick={() => onComposeOpenChange(true)}
          aria-label="New message"
          title="New message"
          className="ripple press w-10 h-10 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100"
        >
          <SquarePen size={24} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 md:px-5 pb-1 shrink-0">
        <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-gray-100 focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-300">
          <Search size={18} className="text-gray-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or add a friend"
            aria-label="Search chats or add a friend"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-gray-900 placeholder-gray-500"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-gray-500 hover:text-gray-800">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Notes: everyone's next game */}
        {!q && (
          <PartyNotesRow parties={parties} friends={friends} currentUser={currentUser} onOpenParty={onOpenParty} onPlanParty={onPlanParty} />
        )}

        {/* Messages | Requests */}
        <div className="flex items-center justify-between px-4 md:px-5 pt-2 pb-1">
          <h2 className="text-base font-bold text-gray-900">{q ? 'Results' : 'Messages'}</h2>
          {!q && (
            <button onClick={() => setView('requests')} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
              Requests{requestCount > 0 && <span className="text-red-600"> ({requestCount})</span>}
            </button>
          )}
        </div>

        <div key={q ? 'search' : 'all'} className="flex flex-col pb-4 stagger">
          {canAddFriend && (
            <button
              onClick={() => { onAddFriend(query.trim().replace(/^@/, '')); setQuery(''); }}
              className="ripple flex items-center gap-3 px-4 md:px-5 py-2 hover:bg-gray-50 text-left"
            >
              <span className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0"><UserPlus size={22} /></span>
              <span className="min-w-0">
                <span className="block text-[15px] text-gray-900 truncate">Add “{query.trim()}” as a friend</span>
                <span className="block text-[13px] text-gray-500">Send a friend request by username or Gmail</span>
              </span>
            </button>
          )}

          {shown.map((c) => {
            const unread = c.unreadCount || 0;
            const when = c.lastMessage ? toDate(c.lastMessage.timestamp) : null;
            const selected = selectedChatId === c.id;
            return (
              <button
                key={`${c.isGroup ? 'g' : 'u'}_${c.id}`}
                onClick={() => onSelectChat(c)}
                aria-current={selected ? 'true' : undefined}
                className={`ripple flex items-center gap-3 px-4 md:px-5 py-2 text-left ${selected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <span className="relative shrink-0">
                  <img src={c.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-100" />
                  {c.isOnline && !c.isGroup && (
                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                  {c.isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center ring-1 ring-gray-200">
                      <Users size={11} className="text-gray-700" />
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[15px] text-gray-900 truncate ${unread ? 'font-semibold' : ''}`}>{c.name}</span>
                  <span className={`flex text-[13px] min-w-0 ${unread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    <span className="truncate">{subtitle(c)}</span>
                    {when && <span className="shrink-0 whitespace-pre"> · {timeAgoShort(when)}</span>}
                  </span>
                </span>
                {unread > 0 && <span aria-label={`${unread} unread`} className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />}
              </button>
            );
          })}

          {shown.length === 0 && !canAddFriend && (
            <div className="flex flex-col items-center text-center px-6 py-14">
              <p className="text-gray-900 font-semibold">{q ? 'No chats found' : 'No messages yet'}</p>
              <p className="text-sm text-gray-500 mt-1">{q ? 'Type a username or Gmail to add a friend.' : 'Add friends by typing their username or Gmail in the search bar.'}</p>
            </div>
          )}
        </div>
      </div>

      {isComposeOpen && (
        <Portal>
          <NewMessageSheet
            friends={friends}
            currentUser={currentUser}
            onClose={() => onComposeOpenChange(false)}
            onOpenChat={onSelectChat}
            onAddFriend={onAddFriend}
            venue={composeVenue}
          />
        </Portal>
      )}
    </div>
  );
};

export default ChatListView;
