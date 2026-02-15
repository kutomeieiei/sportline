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
  
  // State to track if we have fetched the initial data from the server
  const [isServerDataLoaded, setIsServerDataLoaded] = useState(false);
  
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>([]);
  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  // --- 1. Auth Listener ---
  useEffect(() => {
    if (!auth) {
        console.error("Authentication service is not available.");
        setIsLoadingAuth(false);
        return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      
      if (currentUser) {
        setIsAuthenticated(true);
        // We do not set isServerDataLoaded to true yet. 
        // We wait for the Firestore listener (Effect #2) to fire at least once.
      } else {
        setIsAuthenticated(false);
        setUser(INITIAL_USER);
        setIsServerDataLoaded(true); // No server data needed if not logged in
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- 2. Real-time User Profile Listener (Server Data) ---
  useEffect(() => {
    if (authUser && db) {
        const userRef = doc(db, 'users', authUser.uid);
        
        // This listener fetches data directly from the server (or Firebase SDK internal cache)
        const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as User;
                setUser(userData);
            } else {
                // Fallback if doc doesn't exist on server yet (rare, but handled)
                console.log("No user profile found on server, using defaults.");
                setUser({
                    ...INITIAL_USER,
                    displayName: authUser.displayName || 'User',
                    username: authUser.email?.split('@')[0] || 'user',
                    avatarUrl: authUser.photoURL || INITIAL_USER.avatarUrl
                });
            }
            setIsServerDataLoaded(true);
        }, (error) => {
            console.error("Error fetching server data:", error);
            setIsServerDataLoaded(true); // Stop loading even on error
        });

        return () => unsubscribeUser();
    }
  }, [authUser]);

  // --- 3. Real-time Parties Listener ---
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
    // When logging in via LoginView, we optimistically set the user 
    // while the Firestore listener connects in the background.
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setIsServerDataLoaded(true);
  };

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
    }
    setCurrentTab('explore');
    setSelectedChatUser(null);
    setIsServerDataLoaded(false);
  };

  // --- RENDERING ---

  // 1. Initial Auth Check
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

  // 3. Server Data Loading Gate
  // This ensures we don't show the app until we have the data from the DB
  if (!isServerDataLoaded) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-gray-400 text-sm font-medium">Syncing with server...</p>
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
          // We don't need to manually set user state here anymore because 
          // App.tsx is listening to the database. When SettingsView updates the DB, 
          // the onSnapshot in App.tsx will automatically update the UI.
          onUpdateUser={() => {}} 
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