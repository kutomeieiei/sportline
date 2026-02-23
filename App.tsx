import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import MapView from './components/MapView';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CreatePartyView from './components/CreatePartyView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ChatListView, { ChatUser } from './components/ChatListView';
import ChatDetailView from './components/ChatDetailView';
import { Party, SportType, User, DiscoveryResult } from './types';
import { INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Crosshair, Loader2, Radio, Search } from 'lucide-react';
import { auth, db, firebase } from './firebase'; // Import firebase for compat utilities
import { User as FirebaseUser } from 'firebase/auth';
import { calculateHaversineDistance } from './utils/geospatial';
import { discoverUsers } from './services/discoveryService';
import { updateLocation } from './services/locationService';

// Define libraries outside component to prevent re-render loop
const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [isServerDataLoaded, setIsServerDataLoaded] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>([]);
  
  // Store travel times separately to avoid re-rendering loops
  const [travelTimes, setTravelTimes] = useState<Record<string, string>>({});

  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  // Discovery & Live Location State
  const [discoveredUsers, setDiscoveredUsers] = useState<DiscoveryResult[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Rate limiting for distance matrix
  const lastMatrixCall = useRef<number>(0);

  // --- GOOGLE MAPS LOADER (Centralized) ---
  const rawApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const apiKey = rawApiKey.replace(/['"]/g, '').trim();

  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES
  });

  // --- 1. Auth Listener ---
  useEffect(() => {
    if (!auth) {
        console.error("Authentication service is not available.");
        setIsLoadingAuth(false);
        return;
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setAuthUser(currentUser);
      
      if (currentUser) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(INITIAL_USER);
        setIsServerDataLoaded(true);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- 2. Real-time User Profile Listener ---
  useEffect(() => {
    if (authUser && db) {
        const unsubscribeUser = db.collection('users').doc(authUser.uid).onSnapshot((docSnap) => {
            if (docSnap.exists) {
                const userData = docSnap.data() as User;
                setUser(userData);
            } else {
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
            setIsServerDataLoaded(true);
        });

        return () => unsubscribeUser();
    }
  }, [authUser]);

  // --- 3. Real-time Parties Listener ---
  useEffect(() => {
    if (!isAuthenticated || !db) return;

    const unsubscribeParties = db.collection('parties')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const partiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Party[];
        setParties(partiesData);
    });

    return () => unsubscribeParties();
  }, [isAuthenticated]);

  // Live Location Update Loop
  useEffect(() => {
    if (!isAuthenticated || !authUser || !isLive) return;

    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          setUserLocation(newPos);
          
          // Update server
          updateLocation(
            authUser.uid,
            latitude,
            longitude,
            'live',
            true
          ).catch(console.error);
        },
        (error) => {
          console.error("Error watching position:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isAuthenticated, authUser, isLive]);

  // --- 4. TIER 2: Spatial Refinement (Distance Sorting) ---
  const sortedParties = useMemo(() => {
    const filtered = selectedSport === 'All' 
        ? parties 
        : parties.filter(p => p.sport === selectedSport);
    
    // Calculate distance for each party relative to current map center
    const withDistance = filtered.map(party => {
        const dist = calculateHaversineDistance(
            mapCenter.lat, 
            mapCenter.lng, 
            party.latitude, 
            party.longitude
        );
        // Inject travel time if we have it calculated
        const time = travelTimes[party.id];
        return { ...party, distance: dist, travelTime: time };
    });

    // Sort by distance (ASC)
    return withDistance.sort((a, b) => a.distance - b.distance);
  }, [parties, selectedSport, mapCenter, travelTimes]);

  // --- 5. TIER 3: Distance Matrix (Travel Time) Logic ---
  useEffect(() => {
    // Only fetch if google maps is loaded and we have parties
    if (!isMapsLoaded || typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) return;
    if (sortedParties.length === 0) return;

    // Debounce: Only call every 5 seconds max to avoid quota limits
    const now = Date.now();
    if (now - lastMatrixCall.current < 5000) return;
    lastMatrixCall.current = now;

    // Take top 10 closest parties to calculate precise time for
    const topCandidates = sortedParties.slice(0, 10);
    const destinations = topCandidates.map(p => ({ lat: p.latitude, lng: p.longitude }));

    // If we already have times for all these, skip
    const allHaveTime = topCandidates.every(p => travelTimes[p.id]);
    if (allHaveTime && topCandidates.length > 0) return;

    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix({
        origins: [mapCenter],
        destinations: destinations,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
    }, (response: google.maps.DistanceMatrixResponse, status: google.maps.DistanceMatrixStatus) => {
        if (status === 'OK' && response.rows[0].elements) {
            const results = response.rows[0].elements;
            const newTimes: Record<string, string> = {};
            
            results.forEach((element: google.maps.DistanceMatrixResponseElement, index: number) => {
                if (element.status === 'OK' && element.duration) {
                    const partyId = topCandidates[index].id;
                    newTimes[partyId] = element.duration.text;
                }
            });

            // Update state safely
            setTravelTimes(prev => ({ ...prev, ...newTimes }));
        }
    });

  }, [sortedParties, mapCenter, isMapsLoaded, travelTimes]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setIsServerDataLoaded(true);
  };

  const handleLogout = async () => {
    if (auth) {
        await auth.signOut();
    }
    setCurrentTab('explore');
    setSelectedChatUser(null);
    setIsServerDataLoaded(false);
  };

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
        await db.collection('parties').doc(partyId).update({
            members: firebase.firestore.FieldValue.arrayUnion(user.username),
            playersCurrent: (parties.find(p => p.id === partyId)?.playersCurrent || 0) + 1
        });
    } catch (error) {
        console.error("Error joining party:", error);
    }
  };

  const handleRecenter = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPos = { lat: latitude, lng: longitude };
          setMapCenter(newPos);
          setUserLocation(newPos);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Fallback to default if error, or just alert user
          // alert("Could not get your location. Please enable location services.");
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  };

  // Attempt to get user location on load
  useEffect(() => {
    if (isMapsLoaded) {
      handleRecenter();
    }
  }, [isMapsLoaded]);
  
  const handleLocationSelect = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  };

  // Handle "Go Live" Toggle
  const handleToggleLive = async () => {
    if (!authUser) return;
    const newStatus = !isLive;
    setIsLive(newStatus);
    
    // Immediate update
    const lat = userLocation?.lat || mapCenter.lat;
    const lng = userLocation?.lng || mapCenter.lng;

    await updateLocation(
      authUser.uid,
      lat,
      lng,
      newStatus ? 'live' : 'static',
      newStatus
    );
  };

  // Handle Discovery
  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const results = await discoverUsers(mapCenter.lat, mapCenter.lng, 5000); // 5km radius
      setDiscoveredUsers(results);
    } catch (error) {
      console.error("Discovery failed", error);
    } finally {
      setIsDiscovering(false);
    }
  };

  if (isLoadingAuth) {
     return (
        <div className="w-full h-screen flex items-center justify-center bg-white">
            <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
     );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (!isServerDataLoaded) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-gray-400 text-sm font-medium">Syncing with server...</p>
        </div>
     );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
      
      {/* Map Layer */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <MapView 
            parties={sortedParties} 
            discoveredUsers={discoveredUsers}
            center={mapCenter} 
            currentUser={user.username}
            onJoinParty={handleJoinParty}
            isLoaded={isMapsLoaded}
            loadError={mapsLoadError}
            isLive={isLive}
            userLocation={userLocation}
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
            isLoaded={isMapsLoaded}
          />

          {/* Live Toggle */}
          <button
            onClick={handleToggleLive}
            className={`absolute top-24 right-4 p-3 rounded-full shadow-lg z-[1000] border transition-colors ${isLive ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-600 border-gray-100'}`}
            title="Toggle Live Visibility"
          >
            <Radio size={24} className={isLive ? 'animate-pulse' : ''} />
          </button>

          {/* Discover Button */}
          <button 
            onClick={handleDiscover}
            className="absolute bottom-40 right-4 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-blue-600 z-[1000] border border-gray-100"
            title="Discover Nearby Users"
          >
            {isDiscovering ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
          </button>

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
          isLoaded={isMapsLoaded}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView 
          user={user}
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
