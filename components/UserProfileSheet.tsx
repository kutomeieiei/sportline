import React, { useEffect, useState } from 'react';
import { ArrowLeft, X, UserPlus, UserCheck, Clock, MessageCircle, MapPin, Loader2, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { Party, User } from '../types';
import { fallbackAvatar } from '../utils/image';
import { bySoonest, isPartyOver, partyWhen, sportEmoji } from '../utils/party';
import Portal from './Portal';

export interface ProfileTarget {
  uid: string;
  /** What we already know about them, shown while the full profile loads. */
  preview?: Partial<User>;
  /** How far away they are (from "find players"), in meters. */
  distanceM?: number;
  /** The sport they're looking for right now, if they're sharing it. */
  lookingFor?: string;
}

interface UserProfileSheetProps extends ProfileTarget {
  myUid: string;
  parties: Party[];
  onClose: () => void;
  onAddFriend: (usernameOrEmail: string) => void;
  onAcceptFriend: (uid: string) => void;
  onMessage: (user: User) => void;
  onOpenParty: (party: Party) => void;
}

type FriendStatus = 'loading' | 'none' | 'sent' | 'pending' | 'accepted';

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`);

/** Someone's profile: who they are, what they play, and buttons to add or message them. */
const UserProfileSheet: React.FC<UserProfileSheetProps> = ({
  uid, preview, distanceM, lookingFor, myUid, parties, onClose, onAddFriend, onAcceptFriend, onMessage, onOpenParty,
}) => {
  const [profile, setProfile] = useState<User | null>(preview ? ({ uid, ...preview } as User) : null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<FriendStatus>('loading');
  const [sending, setSending] = useState(false);
  const isMe = uid === myUid;

  // Their profile, kept up to date.
  useEffect(() => db.collection('users').doc(uid).onSnapshot(
    (snap) => { if (snap.exists) setProfile({ uid, ...snap.data() } as User); setLoaded(true); },
    () => setLoaded(true),
  ), [uid]);

  // Are we friends? (my friends list stores: sent / pending / accepted)
  useEffect(() => {
    if (!myUid || isMe) return;
    return db.collection('users').doc(myUid).collection('friends').doc(uid).onSnapshot(
      (snap) => {
        const s = snap.exists ? (snap.data()?.status as string | undefined) : undefined;
        setStatus(s === 'sent' || s === 'pending' ? s : snap.exists ? 'accepted' : 'none');
        setSending(false);
      },
      () => setStatus('none'),
    );
  }, [uid, myUid, isMe]);

  // Close with the Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = profile?.display_name || profile?.displayName || profile?.username || 'Player';
  const avatar = profile?.profile_img_url || profile?.avatarUrl || fallbackAvatar(name);
  const sports: string[] = profile?.preferred_sports?.length
    ? profile.preferred_sports
    : ((profile as unknown as { preferredSports?: string[] })?.preferredSports || []);
  const games = parties
    .filter((p) => !isPartyOver(p) && (p.hostUid === uid || (!!profile?.username && (p.members || []).includes(profile.username))))
    .sort(bySoonest);

  const addFriend = () => {
    const who = profile?.username || profile?.email;
    if (!who) return;
    setSending(true);
    onAddFriend(who);
    setTimeout(() => setSending(false), 4000);
  };

  const friendButton = () => {
    const base = 'press flex-1 h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5';
    if (status === 'loading' || sending) {
      return <button disabled className={`${base} bg-gray-100 text-gray-500`}><Loader2 size={16} className="animate-spin" /></button>;
    }
    if (status === 'accepted') {
      return <button disabled className={`${base} bg-gray-100 text-gray-900`}><UserCheck size={16} /> Friends</button>;
    }
    if (status === 'sent') {
      return <button disabled className={`${base} bg-gray-100 text-gray-700`}><Clock size={16} /> Requested</button>;
    }
    if (status === 'pending') {
      return <button onClick={() => onAcceptFriend(uid)} className={`${base} bg-red-600 text-white hover:bg-red-700`}><UserCheck size={16} /> Confirm request</button>;
    }
    return (
      <button onClick={addFriend} disabled={!profile?.username && !profile?.email} className={`${base} bg-red-600 text-white hover:bg-red-700 disabled:bg-red-200`}>
        <UserPlus size={16} /> Add friend
      </button>
    );
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[3500] bg-black/40 backdrop-in flex md:items-center md:justify-center" onClick={onClose}>
        <div
          role="dialog"
          aria-label={`${name}'s profile`}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full h-full md:h-auto md:max-h-[88vh] md:max-w-md md:rounded-2xl flex flex-col overflow-hidden shadow-elev-3 animate-in slide-in-from-right md:zoom-in"
        >
          {/* Top bar */}
          <div className="relative flex items-center justify-center h-14 border-b border-gray-200 shrink-0 px-12">
            <button onClick={onClose} aria-label="Back" className="md:hidden press absolute left-2 w-10 h-10 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-base font-semibold text-gray-900 truncate">{profile?.username ? `@${profile.username}` : name}</h2>
            <button onClick={onClose} aria-label="Close" className="hidden md:flex press absolute right-2 w-10 h-10 rounded-full items-center justify-center text-gray-700 hover:bg-gray-100">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            {/* Photo + name */}
            <div className="flex items-center gap-5 px-5 pt-5">
              <img src={avatar} alt="" className="w-[88px] h-[88px] rounded-full object-cover bg-gray-100 shrink-0" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-900 leading-tight break-words">{name}</p>
                {profile?.username && <p className="text-sm text-gray-500 truncate">@{profile.username}</p>}
                {distanceM !== undefined && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> {formatDistance(distanceM)}</p>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile?.bio ? (
              <p className="px-5 mt-3 text-[15px] text-gray-900 whitespace-pre-wrap break-words">{profile.bio}</p>
            ) : loaded ? (
              <p className="px-5 mt-3 text-sm text-gray-400">No bio yet.</p>
            ) : null}

            {/* Buttons */}
            {!isMe && (
              <div className="flex gap-2 px-5 mt-4">
                {friendButton()}
                <button
                  onClick={() => profile && onMessage(profile)}
                  disabled={!profile}
                  className="press flex-1 h-9 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 flex items-center justify-center gap-1.5"
                >
                  <MessageCircle size={16} /> Message
                </button>
              </div>
            )}

            {/* About */}
            <div className="mx-5 mt-5 rounded-2xl border border-gray-200 divide-y divide-gray-100">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-gray-500">Gender</span>
                <span className="text-sm font-medium text-gray-900 text-right">{profile?.gender || 'Not shared'}</span>
              </div>
              {lookingFor && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-gray-500">Looking for</span>
                  <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 ring-1 ring-green-200 text-xs font-semibold">
                    {sportEmoji(lookingFor)} {lookingFor === 'All' ? 'Any sport' : lookingFor}
                  </span>
                </div>
              )}
              <div className="px-4 py-3">
                <p className="text-sm text-gray-500">Sports</p>
                {sports.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sports.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">{sportEmoji(s)} {s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">No favourite sports yet.</p>
                )}
              </div>
            </div>

            {/* Their upcoming games */}
            {games.length > 0 && (
              <div className="mt-5">
                <p className="px-5 pb-1 text-sm font-semibold text-gray-900">Upcoming games</p>
                {games.map((g) => (
                  <button key={g.id} onClick={() => onOpenParty(g)} className="ripple w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 text-left">
                    <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg shrink-0">{sportEmoji(g.sport)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-gray-900 truncate">{g.title}</span>
                      <span className="block text-[13px] text-gray-500 truncate">
                        {partyWhen(g)} · {g.playersCurrent}/{g.playersMax} players{g.hostUid === uid ? ' · Host' : ''}
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default UserProfileSheet;
