import React, { useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { resizeImageToDataUrl, fallbackAvatar } from '../utils/image';
import CameraCapture from './CameraCapture';

interface EditGroupModalProps {
  chatId: string;
  currentName: string;
  currentAvatar: string;
  /** Called with a short summary like "changed the group name to X". */
  onSaved: (summary: string) => void;
  onClose: () => void;
}

/** Any group member can rename the group or change its photo. */
const EditGroupModal: React.FC<EditGroupModalProps> = ({ chatId, currentName, currentAvatar, onSaved, onClose }) => {
  const [name, setName] = useState(currentName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const usePhoto = async (file: File) => {
    try {
      setAvatar(await resizeImageToDataUrl(file, 256));
    } catch (err) {
      alert((err as Error).message || 'Could not use this image.');
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { alert('Group name is required.'); return; }
    if (trimmed.length > 50) { alert('Group name must be 50 characters or less.'); return; }
    const nameChanged = trimmed !== currentName;
    const photoChanged = avatar !== currentAvatar;
    if (!nameChanged && !photoChanged) { onClose(); return; }

    setSaving(true);
    try {
      // Groups without a custom photo use initials; refresh them for the new name.
      const usesInitials = !avatar || avatar.startsWith('https://ui-avatars.com/');
      const avatarUrl = usesInitials && nameChanged ? fallbackAvatar(trimmed) : avatar;
      await db.collection('chats').doc(chatId).update({ name: trimmed, avatarUrl });
      onSaved(nameChanged && photoChanged
        ? `changed the group name to "${trimmed}" and updated the photo`
        : nameChanged ? `changed the group name to "${trimmed}"` : 'changed the group photo');
      onClose();
    } catch (err) {
      console.error('Could not update group', err);
      alert('Could not save the group. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit Group</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700"><X size={18} /></button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <img src={avatar || fallbackAvatar(name)} alt="Group" className="w-24 h-24 rounded-full object-cover border-2 border-zinc-700" />
          <div className="flex items-center gap-4 text-sm font-semibold">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-red-500 hover:text-red-400">
              <ImageIcon size={16} /> Choose Photo
            </button>
            <span className="text-zinc-700">|</span>
            <button onClick={() => setCameraOpen(true)} className="flex items-center gap-1 text-red-500 hover:text-red-400">
              <Camera size={16} /> Take Photo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) usePhoto(f); }}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-1">Group Name</label>
          <input
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl outline-none focus:border-red-500 text-white"
            placeholder="Group name"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />} Save
        </button>
      </div>

      {cameraOpen && (
        <CameraCapture title="Group photo" initialFacing="user" onCapture={usePhoto} onClose={() => setCameraOpen(false)} />
      )}
    </div>
  );
};

export default EditGroupModal;
