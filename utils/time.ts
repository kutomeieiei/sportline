// Time labels for chats.

type TimestampLike = { toDate?: () => Date; toMillis?: () => number } | Date | number | string | null | undefined;

export const toDate = (ts: TimestampLike): Date | null => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number' || typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/** Short "how long ago": now, 5m, 3h, 2d, 3w, 1y. */
export const timeAgoShort = (d: Date, now = Date.now()) => {
  const seconds = Math.max(0, (now - d.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
};

/** Label between messages: "18:05", "Sat 23:47", "Nov 3, 18:05" or "Nov 3, 2025, 18:05". */
export const separatorLabel = (d: Date, now = new Date()) => {
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return time;
  if (startOfToday - d.getTime() < 6 * 86_400_000) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  return `${d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}, ${time}`;
};
