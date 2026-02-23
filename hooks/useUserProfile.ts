import { useState, useEffect } from 'react';
import { db } from '../services/firebaseService';
import { User } from '../types';
import { INITIAL_USER } from '../constants';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useUserProfile(authUser: FirebaseUser | null) {
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [isServerDataLoaded, setIsServerDataLoaded] = useState(false);

  useEffect(() => {
    if (authUser) {
      const userRef = doc(db, 'users', authUser.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        } else {
          // Create a default profile for new users
          const newUserProfile: User = {
            ...INITIAL_USER,
            uid: authUser.uid,
            displayName: authUser.displayName || 'New User',
            username: authUser.email?.split('@')[0] || 'new_user',
            avatarUrl: authUser.photoURL || INITIAL_USER.avatarUrl,
          };
          setDoc(userRef, newUserProfile);
          setUser(newUserProfile);
        }
        setIsServerDataLoaded(true);
      }, (error) => {
        console.error("Error fetching user profile:", error);
        setIsServerDataLoaded(true);
      });

      return () => unsubscribe();
    } else {
      setUser(INITIAL_USER);
      setIsServerDataLoaded(true);
    }
  }, [authUser]);

  return { user, setUser, isServerDataLoaded };
}
