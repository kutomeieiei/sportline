import React, { useState } from 'react';
import { X, Check, Loader2, Users } from 'lucide-react';
import { db, firebase } from '../firebase';
import { User } from '../types';
import { fallbackAvatar } from '../utils/image';

interface AddMembersModalProps {
  chatId: string;
  friends: User[];
  memberIds: string[];
  /** Called with the added people's names, e.g. "Bob and Carol". */
  onAdded: (names: string) => void;
  onClose: () => void;
}

const MAX_GROUP_SIZE = 50;

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** Lets a group member add their friends to the group. */
const AddMembersModal: React.FC<AddMembersModalProps> = ({ chatId, friends, memberIds, onAdded, onClose }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const candidates = friends.filter((f) => f.uid && !memberIds.includes(f.uid));
  const nameOf = (f: User) => f.display_name || f.displayName || f.username || 'Friend';

  const toggle = (uid: string) =>
    setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const add = async () => {
    if (selected.length === 0) return;
    if (memberIds.length + selected.length > MAX_GROUP_SIZE) {
      alert(`Groups can have up to ${MAX_GROUP_SIZE} members.`);
      return;
    }
    setSaving(true);
    try {
      await db.collection('chats').doc(chatId).update({
        members: firebase.firestore.FieldValue.arrayUnion(...selected),
      });
      onAdded(joinNames(candidates.filter((f) => selected.includes(f.uid)).map(nameOf)));
      onClose();
    } catch (err) {
      console.error('Could not add members', err);
      alert('Could not add members. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-in flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-elev-3 sheet-up sm:animate-none flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Add Members</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-14 px-6">
              <Users size={36} className="text-gray-400" />
              <p className="text-gray-600 text-sm">
                {friends.length === 0 ? 'Add some friends first, then you can add them to groups.' : 'All your friends are already in this group.'}
              </p>
            </div>
          ) : candidates.map((f) => {
            const isSelected = selected.includes(f.uid);
            return (
              <button
                key={f.uid}
                onClick={() => toggle(f.uid)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-100 transition-colors"
              >
                <img src={f.profile_img_url || f.avatarUrl || fallbackAvatar(nameOf(f))} alt="" className="w-11 h-11 rounded-full object-cover border border-gray-200" />
                <span className="flex-1 text-left text-gray-900 font-medium truncate">{nameOf(f)}</span>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                  {isSelected && <Check size={14} className="text-gray-900" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={add}
            disabled={saving || selected.length === 0}
            className="w-full py-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {selected.length > 0 ? `Add ${selected.length} ${selected.length === 1 ? 'person' : 'people'}` : 'Select friends to add'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMembersModal;
