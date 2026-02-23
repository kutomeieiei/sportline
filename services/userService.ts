import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User } from '../types';

export const updateProfile = async (uid: string, data: Partial<User>) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, data, { merge: true });
};

export const getProfile = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as User;
  }
  return null;
};
