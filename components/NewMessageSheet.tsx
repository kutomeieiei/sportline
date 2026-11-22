import React, { useState } from 'react';
import { X, Check, UserPlus, Loader2 } from 'lucide-react';
import { db, firebase } from '../firebase';
import { User, Venue } from '../types';
import { fallbackAvatar } from '../utils/image';
import { recordMessage } from '../services/chatMeta';
import { ChatUser } from './ChatListView';

interface NewMessageSheetProps {
  friends: User[];
  currentUser: User;
  onClose: () => void;
  onOpenChat: (chat: ChatUser) => void;
  onAddFriend: (usernameOrEmail: string) => void;
  /** Making a group about this venue (from the map). */
  venue?: Venue | null;
}

const nameOf = (u: User) => u.display_name || u.displayName || u.username || 'Player';
const avatarOf = (u: User) => u.profile_img_url || u.avatarUrl || fallbackAvatar(nameOf(u));

/**
 * "New message": pick one friend to chat, or several to start a group chat.
 * If the name you type isn't a friend yet, you can add them from here.
 */
const NewMessageSheet: React.FC<NewMessageSheetProps> = ({ friends, currentUser, onClose, onOpenChat, onAddFriend, venue }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState(venue ? venue.name.slice(0, 50) : '');
  // A venue group is a group even with one friend.
  const makingGroup = !!venue || selected.length >= 2;
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = friends.filter((f) => f.uid && (
    !q || nameOf(f).toLowerCase().includes(q) || (f.username || '').toLowerCase().includes(q) || (f.email || '').toLowerCase() === q
  ));
  const canAddFriend = q.length >= 3 && !friends.some((f) => (f.username || '').toLowerCase() === q.replace(/^@/, '') || (f.email || '').toLowerCase() === q);

  const toggle = (f: User) => {
    setSelected((s) => (s.some((x) => x.uid === f.uid) ? s.filter((x) => x.uid !== f.uid) : [...s, f]));
    setQuery('');
  };

  const defaultGroupName = () => {
    const first = selected.map((f) => nameOf(f).split(' ')[0]);
    const name = first.length > 3 ? `${first.slice(0, 3).join(', ')} & ${first.length - 3} more` : first.join(', ');
    return name.slice(0, 50);
  };

  const start = async () => {
    if (selected.length === 0 || busy) return;
    if (selected.length === 1 && !venue) {
      const f = selected[0];
      onOpenChat({ id: f.uid, name: nameOf(f), avatarUrl: avatarOf(f), isGroup: false, isOnline: f.isOnline });
      onClose();
      return;
    }
    setBusy(true);
    try {
      const name = (groupName.trim() || defaultGroupName()).slice(0, 50);
      const members = [...selected.map((f) => f.uid), currentUser.uid];
      const avatarUrl = fallbackAvatar(name);
      const ref = await db.collection('chats').add({ name, isGroup: true, members, createdAt: new Date(), avatarUrl });
      const text = `${currentUser.display_name || currentUser.displayName || 'Someone'} created the group.`;
      await ref.collection('messages').add({ text, senderId: currentUser.uid, timestamp: new Date(), type: 'system' });
      await recordMessage(ref.id, members, currentUser.uid, 'system', text).catch(() => {});
      if (venue) {
        // Start the group with the venue's card.
        const { distance: _distance, ...venueData } = venue;
        void _distance;
        const shareText = `Let's play at ${venue.name}`;
        await ref.collection('messages').add({
          text: shareText, type: 'venue_share', venue: venueData, senderId: currentUser.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await recordMessage(ref.id, members, currentUser.uid, 'venue_share', shareText).catch(() => {});
      }
      onOpenChat({ id: ref.id, name, avatarUrl, isGroup: true, members: members.length });
      onClose();
    } catch (e) {
      console.error('Error creating group:', e);
      alert('Could not create the group. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-in flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="New message"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md h-[88vh] sm:h-[70vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-elev-3 sheet-up sm:animate-in sm:zoom-in"
      >
        <div className="relative flex items-center justify-center h-14 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 truncate px-12">{venue ? `New group at ${venue.name}` : 'New message'}</h2>
          <button onClick={onClose} aria-label="Close" className="press absolute right-2 w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        {/* To: */}
        <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-200 shrink-0">
          <span className="text-[15px] font-semibold text-gray-900 pt-1.5">To:</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
            {selected.map((f) => (
              <button key={f.uid} onClick={() => toggle(f)} className="press flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-red-50 text-red-700 text-sm font-medium">
                {nameOf(f)} <X size={14} />
              </button>
            ))}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 min-w-[120px] h-8 outline-none text-[15px] text-gray-900 placeholder-gray-400 bg-transparent"
            />
          </div>
        </div>

        {makingGroup && (
          <div className="px-4 py-2.5 border-b border-gray-200 shrink-0 animate-in fade-in">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 50))}
              placeholder={`Group name (optional): ${defaultGroupName()}`}
              className="w-full h-10 px-3 rounded-xl bg-gray-100 outline-none text-[15px] text-gray-900 placeholder-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-300"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {canAddFriend && (
            <button
              onClick={() => { onAddFriend(query.trim().replace(/^@/, '')); setQuery(''); }}
              className="ripple w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
            >
              <span className="w-11 h-11 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0"><UserPlus size={20} /></span>
              <span className="min-w-0">
                <span className="block text-[15px] text-gray-900 truncate">Add “{query.trim()}” as a friend</span>
                <span className="block text-[13px] text-gray-500">Username or Gmail address</span>
              </span>
            </button>
          )}
          {!q && <p className="px-4 pt-3 pb-1 text-sm font-semibold text-gray-900">Friends</p>}
          {matches.length === 0 && !canAddFriend && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">{friends.length ? 'No friends match.' : 'Add friends to start chatting.'}</p>
          )}
          {matches.map((f) => {
            const on = selected.some((x) => x.uid === f.uid);
            return (
              <button key={f.uid} onClick={() => toggle(f)} className="ripple w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left">
                <img src={avatarOf(f)} alt="" className="w-11 h-11 rounded-full object-cover bg-gray-100 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-gray-900 truncate">{nameOf(f)}</span>
                  {f.username && <span className="block text-[13px] text-gray-500 truncate">@{f.username}</span>}
                </span>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-red-600 border-red-600 text-white' : 'border-gray-300'}`}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-gray-200 shrink-0 pb-safe">
          <button
            onClick={start}
            disabled={selected.length === 0 || busy}
            className="ripple press w-full h-11 rounded-xl bg-red-600 text-white font-semibold text-[15px] hover:bg-red-700 disabled:bg-red-200 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {makingGroup ? 'Create group chat' : 'Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewMessageSheet;
