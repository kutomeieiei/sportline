import { Party } from '../types';

// Helpers for showing a party ("appointment") as a short note, e.g. "⚽ Today 18:00".

const SPORT_EMOJI: Record<string, string> = {
  Football: '⚽',
  Basketball: '🏀',
  Badminton: '🏸',
  Tennis: '🎾',
  Running: '🏃',
  Cycling: '🚴',
  Yoga: '🧘',
  Volleyball: '🏐',
  Swimming: '🏊',
  Gym: '🏋️',
};

export const sportEmoji = (sport: string) => SPORT_EMOJI[sport] || '🏅';

/** Reads "2026-11-22" + "18:00" as a local date/time. */
const parseLocal = (date?: string, time?: string): Date | null => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '00:00';
  const d = new Date(`${date}T${t}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const partyStart = (p: Party) => parseLocal(p.date, p.startTime);

export const partyEnd = (p: Party): Date | null => {
  const start = partyStart(p);
  const end = parseLocal(p.date, p.endTime);
  if (!end) return start ? new Date(start.getTime() + 2 * 3600_000) : null;
  if (start && end <= start) end.setDate(end.getDate() + 1); // goes past midnight
  return end;
};

/** True once the party has finished. Parties with unreadable dates never count as over. */
export const isPartyOver = (p: Party, now = Date.now()) => {
  const end = partyEnd(p);
  return !!end && end.getTime() < now;
};

/** "Playing now", "Today 18:00", "Tomorrow 9:00", "Sat 18:00" or "Dec 3 18:00". */
export const partyWhen = (p: Party, now = new Date()) => {
  const start = partyStart(p);
  if (!start) return p.startTime || '';
  if (start.getTime() <= now.getTime() && !isPartyOver(p, now.getTime())) return 'Playing now';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const days = Math.round((day - today) / 86_400_000);
  if (days === 0) return `Today ${p.startTime}`;
  if (days === 1) return `Tomorrow ${p.startTime}`;
  if (days > 1 && days < 7) return `${start.toLocaleDateString([], { weekday: 'short' })} ${p.startTime}`;
  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${p.startTime}`;
};

/** Soonest first; parties with unreadable dates go last. */
export const bySoonest = (a: Party, b: Party) =>
  (partyStart(a)?.getTime() ?? Infinity) - (partyStart(b)?.getTime() ?? Infinity);
