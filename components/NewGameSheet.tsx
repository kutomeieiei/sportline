import React, { useEffect, useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { db, firebase } from '../firebase';
import { Party, SportType, User } from '../types';
import { SPORTS_LIST } from '../constants';
import { encodeGeohash } from '../utils/geospatial';
import Portal from './Portal';

interface NewGameSheetProps {
  /** The spot picked on the map. */
  location: { lat: number; lng: number };
  /** Name of the venue, when the game is planned from a venue. */
  placeName?: string;
  currentUser: User;
  onClose: () => void;
  onCreated: (party: Party) => void;
}

// Today's date where the person is (toISOString would give the UTC date).
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inputClass = 'w-full h-11 px-3 rounded-xl bg-gray-100 border border-transparent outline-none text-[15px] text-gray-900 placeholder-gray-500 focus:bg-white focus:border-gray-300';

/**
 * "New game" form that opens after clicking/tapping a spot on the map.
 * The place is the spot that was picked, so there's no map to search here.
 */
const NewGameSheet: React.FC<NewGameSheetProps> = ({ location, placeName: venueName, currentUser, onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    sport: 'Football' as SportType,
    description: '',
    date: localToday(),
    startTime: '18:00',
    endTime: '20:00',
    playersMax: 10,
  });
  const [placeName, setPlaceName] = useState(venueName || 'Pinned on the map');
  const [busy, setBusy] = useState(false);

  // Name the spot (street or area) if Google can tell us; otherwise keep "Pinned on the map".
  useEffect(() => {
    if (venueName || typeof google === 'undefined' || !google.maps?.Geocoder) return;
    let cancelled = false;
    new google.maps.Geocoder().geocode({ location }, (results, status) => {
      if (cancelled || status !== 'OK' || !results?.length) return;
      const best = results.find((r) => r.types.some((t) => ['point_of_interest', 'premise', 'park', 'establishment', 'route'].includes(t))) || results[0];
      const name = best.address_components?.[0]?.long_name || best.formatted_address;
      if (name) setPlaceName(name.slice(0, 80));
    });
    return () => { cancelled = true; };
  }, [location, venueName]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !form.title.trim()) return;
    setBusy(true);
    try {
      const playersMax = Number.isFinite(form.playersMax) ? Math.min(50, Math.max(2, Math.round(form.playersMax))) : 10;
      const partyData = {
        ...form,
        title: form.title.trim().slice(0, 80),
        description: form.description.trim(),
        playersMax,
        playersCurrent: 1,
        latitude: location.lat,
        longitude: location.lng,
        venueName: placeName,
        placeId: '',
        geohash: encodeGeohash(location.lat, location.lng),
        host: currentUser.username,
        hostUid: currentUser.uid,
        members: [currentUser.username],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10_000));
      const ref = await Promise.race([db.collection('parties').add(partyData), timeout]);

      // Every game gets a group chat with the same id.
      await db.collection('chats').doc(ref.id).set({
        isGroup: true,
        name: partyData.title,
        avatarUrl: currentUser.profile_img_url || currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partyData.title)}&background=random`,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        members: [currentUser.uid],
        lastMessage: 'Chat created',
        lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      onCreated({ id: ref.id, ...partyData } as unknown as Party);
    } catch (error) {
      console.error('Error creating party:', error);
      const err = error as { code?: string; message?: string };
      if (err.message === 'TIMEOUT') alert("The server isn't responding. Check your internet connection and try again.");
      else if (err.code === 'permission-denied') alert("Couldn't create the game. Players must be between 2 and 50, and you must be signed in with Google.");
      else alert(`Couldn't create the game: ${err.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-in flex items-end sm:items-center justify-center" onClick={onClose}>
        <form
          role="dialog"
          aria-label="New game"
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-elev-3 sheet-up sm:animate-in sm:zoom-in"
        >
          <div className="relative flex items-center justify-center h-14 border-b border-gray-200 shrink-0">
            <h2 className="text-base font-semibold text-gray-900">New game</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="press absolute right-2 w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Where */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50">
              <MapPin size={20} className="text-red-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{placeName}</p>
                <p className="text-xs text-gray-500">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
              </div>
            </div>

            {/* Sport */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {SPORTS_LIST.filter((s) => s.type !== 'All').map((s) => {
                const on = form.sport === s.type;
                return (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => set('sport', s.type)}
                    aria-pressed={on}
                    className={`press shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium [&_svg]:w-4 [&_svg]:h-4 [&_img]:w-4 [&_img]:h-4 ${on ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                  >
                    {s.icon}{s.label}
                  </button>
                );
              })}
            </div>

            <input
              required
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Name your game (e.g. Evening football)"
              aria-label="Game name"
              className={inputClass}
            />

            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
              <label className="text-xs text-gray-500">Date
                <input required type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={`${inputClass} mt-1 px-2`} />
              </label>
              <label className="text-xs text-gray-500">Start
                <input required type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className={`${inputClass} mt-1 px-2`} />
              </label>
              <label className="text-xs text-gray-500">End
                <input required type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className={`${inputClass} mt-1 px-2`} />
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 text-[15px] text-gray-900 whitespace-nowrap">
              Max players
              <input
                type="number"
                min={2}
                max={50}
                value={form.playersMax}
                onChange={(e) => set('playersMax', parseInt(e.target.value, 10))}
                className={`${inputClass} w-24 text-center`}
              />
            </label>

            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Details (optional): level, what to bring..."
              aria-label="Details"
              className={`${inputClass} h-auto py-2.5 resize-none`}
            />
          </div>

          <div className="p-3 border-t border-gray-200 shrink-0 pb-safe">
            <button
              type="submit"
              disabled={busy || !form.title.trim()}
              className="ripple press w-full h-11 rounded-xl bg-red-600 text-white font-semibold text-[15px] hover:bg-red-700 disabled:bg-red-200 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              Create game
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
};

export default NewGameSheet;
