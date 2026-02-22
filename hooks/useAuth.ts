import { useState, useEffect } from 'react';
import { auth } from '../services/firebaseService';
import { User as FirebaseUser } from 'firebase/auth';

export function useAuth() {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthUser(user);
      setIsAuthenticated(!!user);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  return { authUser, isLoadingAuth, isAuthenticated };
}
