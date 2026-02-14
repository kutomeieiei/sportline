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
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>([]);
  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  // --- Auth & User Data Listener ---
  useEffect(() => {
    // Safety check: if auth failed to initialize (e.g. bad config), stop loading and stay unauthenticated
    if (!auth) {
        console.error("Authentication service is not available. Check Firebase config.");
        setIsLoadingAuth(false);
        return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Fetch extended user profile from Firestore
        const userRef = doc(db!, 'users', currentUser.uid); // db! is safe here if auth works usually
        
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setUser(userSnap.data() as User);
            } else {
                // Fallback if firestore doc missing but auth exists
                setUser({
                    ...INITIAL_USER,
                    displayName: currentUser.displayName || 'User',
                    username: currentUser.email?.split('@')[0] || 'user',
                    avatarUrl: currentUser.photoURL || INITIAL_USER.avatarUrl
                });
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- Real-time Parties Listener ---
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
  };

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
    }
    setIsAuthenticated(false);
    setCurrentTab('explore');
    setSelectedChatUser(null);
  };

  if (isLoadingAuth) {
     return (
        <div className="w-full h-screen flex items-center justify-center bg-white">
            <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
     );
  }

  // If not authenticated, show Login View
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Filter parties based on selection
  const filteredParties = selectedSport === 'All' 
    ? parties 
    : parties.filter(p => p.sport === selectedSport);

  const handleTabChange = (tab: 'explore' | 'create' | 'settings' | 'chat') => {
    setCurrentTab(tab);
    // Reset internal navigations when switching main tabs
    if (tab !== 'chat') {
        setSelectedChatUser(null);
    }
  };

  const handleCreateParty = (newParty: Party) => {
    // Optimistic update handled by Firestore listener, but we switch tabs here
    setCurrentTab('explore');
    setMapCenter({ lat: newParty.latitude, lng: newParty.longitude });
  };

  const handleJoinParty = async (partyId: string) => {
    if (!db) return;
    try {
        const partyRef = doc(db, 'parties', partyId);
        // Using arrayUnion ensures no duplicates and handles concurrency better
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
      
      {/* Map Layer (Always rendered in background) */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <MapView 
            parties={filteredParties} 
            center={mapCenter} 
            currentUser={user.username}
            onJoinParty={handleJoinParty}
        />
      </div>

      {/* Floating UI Elements (Visible only in Explore mode) */}
      {currentTab === 'explore' && (
        <>
          <TopBar 
            selectedSport={selectedSport} 
            onSelectSport={setSelectedSport}
            userAvatar={user.avatarUrl}
            onAvatarClick={() => setCurrentTab('settings')}
            onLocationSelect={handleLocationSelect}
          />

          {/* Recenter Button (FAB) */}
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
          onUpdateUser={setUser}
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