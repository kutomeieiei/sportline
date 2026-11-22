import React from 'react';
import { Plus } from 'lucide-react';
import { Party, User } from '../types';
import { fallbackAvatar } from '../utils/image';
import { bySoonest, isPartyOver, partyWhen, sportEmoji } from '../utils/party';

interface PartyNotesRowProps {
  parties: Party[];
  friends: User[];
  currentUser: User;
  onOpenParty: (party: Party) => void;
  onPlanParty: () => void;
}

const nameOf = (u: User) => u.display_name || u.displayName || u.username || 'Player';
const avatarOf = (u: User) => u.profile_img_url || u.avatarUrl || fallbackAvatar(nameOf(u));

/** A note bubble above someone's photo, showing their next game. */
const NoteItem: React.FC<{
  avatar: string; name: string; party?: Party; placeholder?: string; onClick: () => void; isMe?: boolean;
}> = ({ avatar, name, party, placeholder, onClick, isMe }) => {
  const live = party && partyWhen(party) === 'Playing now';
  return (
    <button
      onClick={onClick}
      className="press relative w-[92px] shrink-0 flex flex-col items-center gap-1.5 group"
      title={party ? `${party.title} · ${partyWhen(party)}` : placeholder}
    >
      <span className={`relative w-[72px] h-[72px] rounded-full p-[2px] ${live ? 'bg-gradient-to-tr from-red-600 to-orange-400' : ''}`}>
        <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover border-2 border-white bg-gray-100" />
        {isMe && !party && (
          <span className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center ring-2 ring-white">
            <Plus size={12} strokeWidth={3} />
          </span>
        )}

        {/* The note: sits on top of the photo and grows upward */}
        <span className="absolute bottom-[calc(100%-14px)] left-1/2 -translate-x-1/2 z-10 w-max max-w-[96px] animate-in fade-in slide-in-from-bottom">
          <span className={`block px-2 py-1.5 rounded-2xl bg-white border border-gray-200 text-[11px] leading-[14px] text-center shadow-sm group-hover:border-gray-300 ${party ? 'text-gray-900' : 'text-gray-500'}`}>
            {party ? (
              <>
                <span className="block font-medium line-clamp-2 break-words">{sportEmoji(party.sport)} {partyWhen(party)}</span>
                <span className="block truncate text-gray-500">{party.title}</span>
              </>
            ) : (
              <span className="block line-clamp-2">{placeholder}</span>
            )}
          </span>
          {/* little "thought" dots */}
          <span className="absolute -bottom-1.5 left-5 w-2 h-2 rounded-full bg-white border border-gray-200" />
          <span className="absolute -bottom-3 left-3.5 w-1 h-1 rounded-full bg-white border border-gray-200" />
        </span>
      </span>
      <span className="w-full truncate text-[12px] text-gray-600 text-center">{name}</span>
    </button>
  );
};

/**
 * Like status notes, but each note is someone's next game. Tap a friend's
 * note to see that game on the map; tap yours to plan one.
 */
const PartyNotesRow: React.FC<PartyNotesRowProps> = ({ parties, friends, currentUser, onOpenParty, onPlanParty }) => {
  const upcoming = parties.filter((p) => !isPartyOver(p)).sort(bySoonest);
  const inParty = (p: Party, u: User) => p.hostUid === u.uid || (!!u.username && (p.members || []).includes(u.username));

  const myParty = upcoming.find((p) => inParty(p, currentUser));
  const friendNotes = friends
    .filter((f) => f.uid && f.uid !== currentUser.uid)
    .map((f) => ({ friend: f, party: upcoming.find((p) => p.hostUid === f.uid) || upcoming.find((p) => inParty(p, f)) }))
    .filter((n): n is { friend: User; party: Party } => !!n.party)
    .sort((a, b) => bySoonest(a.party, b.party));

  return (
    <div className="flex gap-0.5 overflow-x-auto no-scrollbar px-2 md:px-3 pt-12 pb-2">
      <NoteItem
        isMe
        avatar={avatarOf(currentUser)}
        name="Your plan"
        party={myParty}
        placeholder="Plan a game?"
        onClick={() => (myParty ? onOpenParty(myParty) : onPlanParty())}
      />
      {friendNotes.map(({ friend, party }) => (
        <NoteItem key={friend.uid} avatar={avatarOf(friend)} name={nameOf(friend)} party={party} onClick={() => onOpenParty(party)} />
      ))}
    </div>
  );
};

export default PartyNotesRow;
