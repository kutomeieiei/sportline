import React, { useState } from 'react';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { sportEmoji } from '../utils/party';

interface ShareLocationCardProps {
  name: string;
  avatar: string;
  isLive: boolean;
  liveSport?: SportType;
  /** True when we couldn't get the phone's location and use the map's centre instead. */
  usingMapCenter: boolean;
  onStart: (sport: SportType) => Promise<void> | void;
  onStop: () => Promise<void> | void;
}

const sportLabel = (s: SportType) => (s === 'All' ? 'Any sport' : s);

/**
 * "Share my location" card, shown on the map at your position (like a venue's
 * card). Pick what you're up for and start/stop sharing.
 */
const ShareLocationCard: React.FC<ShareLocationCardProps> = ({ name, avatar, isLive, liveSport, usingMapCenter, onStart, onStop }) => {
  const [sport, setSport] = useState<SportType>(liveSport || 'All');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const changed = isLive && sport !== (liveSport || 'All');

  return (
    <div className="w-full sm:w-[268px] font-sans">
      {/* Who + status */}
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover bg-gray-100" referrerPolicy="no-referrer" />
          {isLive && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-white" />}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] text-gray-900 leading-snug">Share my location</h3>
          <p className={`text-xs ${isLive ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
            {isLive ? `Sharing now · ${sportEmoji(liveSport || 'All')} ${sportLabel(liveSport || 'All')}` : `${name}, you're not sharing`}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        People searching nearby will see you on the map until you stop.
      </p>

      {usingMapCenter && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          Location is off, so the map's centre is used. Allow location access for your real spot.
        </p>
      )}

      {/* What are you up for? */}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">What are you up for?</p>
      <div className="mt-1.5 -mx-1 px-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {SPORTS_LIST.map((s) => {
          const on = sport === s.type;
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => setSport(s.type)}
              aria-pressed={on}
              className={`press shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-full text-xs font-medium [&_svg]:w-3.5 [&_svg]:h-3.5 [&_img]:w-3.5 [&_img]:h-3.5 ${on ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              {s.icon}{s.type === 'All' ? 'Any sport' : s.label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-2">
        {!isLive ? (
          <button
            onClick={() => run(() => onStart(sport))}
            disabled={busy}
            className="ripple press w-full h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />} Start sharing
          </button>
        ) : (
          <>
            {changed && (
              <button
                onClick={() => run(() => onStart(sport))}
                disabled={busy}
                className="ripple press w-full h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                Share as {sportLabel(sport)}
              </button>
            )}
            <button
              onClick={() => run(onStop)}
              disabled={busy}
              className="ripple press w-full h-10 rounded-xl bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {busy && <Loader2 size={16} className="animate-spin" />} Stop sharing
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareLocationCard;
