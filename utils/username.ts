import { db } from '../firebase';

// Usernames: 3-20 characters, lowercase letters, numbers, dot or underscore.
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

export const usernameError = (raw: string): string | null => {
  const name = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(name)) {
    return 'Username must be 3-20 characters: letters, numbers, dot (.) or underscore (_).';
  }
  return null;
};

// True if another user (not `myUid`) already has this username.
export const isUsernameTaken = async (raw: string, myUid: string): Promise<boolean> => {
  const name = normalizeUsername(raw);
  const snap = await db.collection('users').where('username', '==', name).limit(2).get();
  return snap.docs.some(d => d.id !== myUid);
};

// Builds a free username from an email/name, e.g. "john.doe", then "john.doe2", ...
export const pickFreeUsername = async (base: string, myUid: string): Promise<string> => {
  let clean = normalizeUsername(base).replace(/[^a-z0-9._]/g, '').slice(0, 16);
  if (clean.length < 3) clean = (clean + 'user').slice(0, 16);
  if (!(await isUsernameTaken(clean, myUid))) return clean;
  for (let i = 0; i < 20; i++) {
    const candidate = `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await isUsernameTaken(candidate, myUid))) return candidate;
  }
  return `${clean}${Date.now().toString().slice(-6)}`;
};
