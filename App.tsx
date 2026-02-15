import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CreatePartyView from './components/CreatePartyView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ChatListView, { ChatUser } from './components/ChatListView';
import ChatDetailView from './components/ChatDetailView';
import { Party, SportType, User } from './types';
import { INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Crosshair, Loader2 } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // New State: Ensures we don't show the app until the profile is ready (either from cache or DB)
  const [isProfileReady, setIsProfileReady] = useState(false);
  
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>([]);
  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  // --- 1. Auth Listener & Instant Load Strategy ---
  useEffect(() => {
    if (!auth) {
        console.error("Authentication service is not available. Check Firebase config.");
        setIsLoadingAuth(false);
        return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      
      if (currentUser) {
        setIsAuthenticated(true);
        
        // 🚀 INSTANT LOAD STRATEGY
        // 1. Try Local Cache
        const cachedProfile = localStorage.getItem(`sportline_profile_${currentUser.uid}`);
        
        if (cachedProfile) {
            try {
                const parsedUser = JSON.parse(cachedProfile);
                setUser(parsedUser);
                console.log("Loaded profile from cache");
            } catch (e) {
                console.warn("Corrupt cache, falling back");
            }
        } else {
            // 2. No Cache? Use Google Data as Fallback IMMEDIATELY
            // Do not wait for Firestore. This prevents the spinner.
            console.log("No cache found, using Auth data temporary");
            setUser({
                ...INITIAL_USER,
                displayName: currentUser.displayName || 'User',
                username: currentUser.email?.split('@')[0] || 'user',
                avatarUrl: currentUser.photoURL || INITIAL_USER.avatarUrl
            });
        }
        
        // Mark profile as ready immediately. 
        // Firestore listener (Effect #2) will update this with fresh data in the background.
        setIsProfileReady(true);
        
      } else {
        setIsAuthenticated(false);
        setIsProfileReady(true);
        setUser(INITIAL_USER); 
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- 2. Real-time User Profile Listener (Source of Truth) ---
  // This runs in the background. When data arrives from DB, it silently updates the UI.
  useEffect(() => {
    if (authUser && db) {
        const userRef = doc(db, 'users', authUser.uid);
        
        const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as User;
                
                // Update State
                setUser(userData);
                
                // Update Cache for next time
                localStorage.setItem(`sportline_profile_${authUser.uid}`, JSON.stringify(userData));
            }
            // If doc doesn't exist (yet), we just stick with the Auth data we set in Effect #1.
            setIsProfileReady(true);
        }, (error) => {
            console.error("Error listening to user profile:", error);
            setIsProfileReady(true); 
        });

        return () => unsubscribeUser();
    }
  }, [authUser]);

  // --- 3. Watch for Local User Updates (Optimistic Updates) ---
  useEffect(() => {
    if (authUser && user && user.username !== INITIAL_USER.username) {
        localStorage.setItem(`sportline_profile_${authUser.uid}`, JSON.stringify(user));
    }
  }, [user, authUser]);

  // --- 4. Real-time Parties Listener ---
  useEffect(() => {
    if (!isAuthenticated || !db) return;

    const q = query(collection(db, 'parties'), orderBy('createdAt', 'desc'));
    const unsubscribeParties = onSnapshot(q, (snapshot) => {
      const partiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Party[];
      setParties(partiesData);
    });

    return () => unsubscribeParties();
  }, [isAuthenticated]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setIsProfileReady(true);
    
    // Save to cache immediately
    if (auth?.currentUser) {
        localStorage.setItem(`sportline_profile_${auth.currentUser.uid}`, JSON.stringify(loggedInUser));
    }
  };

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
    }
    setCurrentTab('explore');
    setSelectedChatUser(null);
    setIsProfileReady(false);
  };

  // --- RENDERING ---

  // 1. Initial Auth Check (Spinner) - Only shows on very first page load
  if (isLoadingAuth) {
     return (
        <div className="w-full h-screen flex items-center justify-center bg-white">
            <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
     );
  }

  // 2. Login Screen
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  // 3. Profile Loading Gate
  // Should virtually never show due to Instant Load Strategy
  if (!isProfileReady) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        </div>
     );
  }

  // 4. Main App
  const filteredParties = selectedSport === 'All' 
    ? parties 
    : parties.filter(p => p.sport === selectedSport);

  const handleTabChange = (tab: 'explore' | 'create' | 'settings' | 'chat') => {
    setCurrentTab(tab);
    if (tab !== 'chat') {
        setSelectedChatUser(null);
    }
  };

  const handleCreateParty = (newParty: Party) => {
    setCurrentTab('explore');
    setMapCenter({ lat: newParty.latitude, lng: newParty.longitude });
  };

  const handleJoinParty = async (partyId: string) => {
    if (!db) return;
    try {
        const partyRef = doc(db, 'parties', partyId);
        await updateDoc(partyRef, {
            members: arrayUnion(user.username),
            playersCurrent: (parties.find(p => p.id === partyId)?.playersCurrent || 0) + 1
        });
    } catch (error) {
        console.error("Error joining party:", error);
    }
  };

  const handleRecenter = () => {
    setMapCenter({ ...DEFAULT_CENTER, lat: DEFAULT_CENTER.lat + (Math.random() * 0.001) });
  };
  
  const handleLocationSelect = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
      
      {/* Map Layer */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <MapView 
            parties={filteredParties} 
            center={mapCenter} 
            currentUser={user.username}
            onJoinParty={handleJoinParty}
        />
      </div>

      {/* Floating UI Elements */}
      {currentTab === 'explore' && (
        <>
          <TopBar 
            selectedSport={selectedSport} 
            onSelectSport={setSelectedSport}
            userAvatar={user.avatarUrl}
            onAvatarClick={() => setCurrentTab('settings')}
            onLocationSelect={handleLocationSelect}
          />

          <button 
            onClick={handleRecenter}
            className="absolute bottom-24 right-4 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-blue-600 z-[1000] border border-gray-100"
          >
            <Crosshair size={24} />
          </button>
        </>
      )}

      {/* Overlay Views */}
      {currentTab === 'create' && (
        <CreatePartyView 
          onClose={() => setCurrentTab('explore')} 
          onCreate={handleCreateParty}
          userLocation={mapCenter}
          currentUser={user.username}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView 
          user={user}
          onUpdateUser={(updatedUser) => {
             setUser(updatedUser); 
          }}
          onClose={() => setCurrentTab('explore')}
          onLogout={handleLogout}
        />
      )}

      {/* Chat Views */}
      {currentTab === 'chat' && (
        <div className="absolute inset-0 bottom-[72px] z-[1000] bg-white">
            {selectedChatUser ? (
                <ChatDetailView 
                    chatUser={selectedChatUser} 
                    onBack={() => setSelectedChatUser(null)} 
                />
            ) : (
                <ChatListView 
                    onSelectChat={setSelectedChatUser} 
                />
            )}
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />

    </div>
  );
}

export default App;