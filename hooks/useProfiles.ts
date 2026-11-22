import { useEffect, useReducer } from 'react';
import { db } from '../firebase';
import { User } from '../types';

// Shared cache of people's profiles (name + photo), so the map and chat don't
// load the same person again and again.
const cache = new Map<string, User | null>();
const loading = new Set<string>();
const subscribers = new Set<() => void>();

/** Returns the profiles for these user ids that have loaded so far. */
export function useProfiles(uids: string[]): Record<string, User> {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const key = Array.from(new Set(uids.filter(Boolean))).sort().join(',');

  useEffect(() => {
    subscribers.add(rerender);
    return () => { subscribers.delete(rerender); };
  }, []);

  useEffect(() => {
    const missing = key ? key.split(',').filter((uid) => !cache.has(uid) && !loading.has(uid)) : [];
    if (missing.length === 0) return;
    missing.forEach((uid) => loading.add(uid));
    Promise.all(missing.map((uid) => db.collection('users').doc(uid).get()
      .then((snap) => { cache.set(uid, snap.exists ? ({ uid, ...snap.data() } as User) : null); })
      .catch(() => { cache.set(uid, null); })
      .finally(() => { loading.delete(uid); })))
      .then(() => subscribers.forEach((fn) => fn()));
  }, [key]);

  const result: Record<string, User> = {};
  if (key) key.split(',').forEach((uid) => { const p = cache.get(uid); if (p) result[uid] = p; });
  return result;
}
