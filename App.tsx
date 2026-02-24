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
import { Party, SportType, User, DiscoveryResult, Venue } from './types';
import { INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Crosshair, Loader2, Radio, Search, Activity } from 'lucide-react';
import { auth, db, firebase } from './firebase'; // Import firebase for compat utilities
import { User as FirebaseUser } from 'firebase/auth';
import { calculateHaversineDistance } from './utils/geospatial';
import { discoverUsers } from './services/discoveryService';
import { updateLocation } from './services/locationService';
import { getVenues, addVenue } from './services/venueService';
import VenueAdminView from './components/VenueAdminView';
import PlaySportModal from './components/PlaySportModal';
import UserSelectionView from './components/UserSelectionView';

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
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<User[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  
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
  const [isVenueAdminOpen, setIsVenueAdminOpen] = useState(false);
  const [isSharingVenue, setIsSharingVenue] = useState(false);
  const [venueToShare, setVenueToShare] = useState<Venue | null>(null);
  const [isPlaySportModalOpen, setIsPlaySportModalOpen] = useState(false);
  const [broadcastingSport, setBroadcastingSport] = useState<SportType | undefined>(undefined);

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
                setUser({ ...userData, uid: authUser.uid });
            } else {
                setUser({
                    ...INITIAL_USER,
                    uid: authUser.uid,
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

  // --- Real-time Friends Listener ---
  useEffect(() => {
    if (!authUser || !db) return;

    const unsubscribeFriends = db.collection('users').doc(authUser.uid).collection('friends').onSnapshot(async (snapshot) => {
      const friendDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter by status
      // 'accepted' or undefined (legacy) -> Friends
      // 'pending' -> Friend Requests (incoming)
      const acceptedIds = friendDocs.filter(d => d.status === 'accepted' || !d.status).map(d => d.id);
      const pendingIds = friendDocs.filter(d => d.status === 'pending').map(d => d.id);

      // 1. Fetch Accepted Friends
      if (acceptedIds.length > 0) {
        const friendPromises = acceptedIds.map(uid => db.collection('users').doc(uid).get());
        const friendDocs = await Promise.all(friendPromises);
        const friendsData = friendDocs.map(doc => {
          const data = doc.data();
          return data ? { ...data, uid: doc.id } as User : null;
        }).filter((u): u is User => u !== null);
        setFriends(friendsData);
      } else {
        setFriends([]);
      }

      // 2. Fetch Pending Requests
      if (pendingIds.length > 0) {
        const requestPromises = pendingIds.map(uid => db.collection('users').doc(uid).get());
        const requestDocs = await Promise.all(requestPromises);
        const requestsData = requestDocs.map(doc => {
          const data = doc.data();
          return data ? { ...data, uid: doc.id } as User : null;
        }).filter((u): u is User => u !== null);
        setFriendRequests(requestsData);
      } else {
        setFriendRequests([]);
      }
    });

    return () => unsubscribeFriends();
  }, [authUser]);

  // --- Fetch Venues (One-time) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchVenues = async () => {
        const venueData = await getVenues();
        setVenues(venueData);
    };

    fetchVenues();
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
    
    const calculationCenter = userLocation || mapCenter;
    // Calculate distance for each party relative to the user's live location or map center
    const withDistance = filtered.map(party => {
        const dist = calculateHaversineDistance(
            calculationCenter.lat, 
            calculationCenter.lng, 
            party.latitude, 
            party.longitude
        );
        // Inject travel time if we have it calculated
        const time = travelTimes[party.id];
        return { ...party, distance: dist, travelTime: time };
    });

    // Sort by distance (ASC)
    return withDistance.sort((a, b) => a.distance - b.distance);
  }, [parties, selectedSport, mapCenter, travelTimes, userLocation]);

  const venuesWithDistance = useMemo(() => {
    const calculationCenter = userLocation || mapCenter;
    return venues.map(venue => ({
      ...venue,
      distance: calculateHaversineDistance(
        calculationCenter.lat,
        calculationCenter.lng,
        venue.latitude,
        venue.longitude
      )
    }));
  }, [venues, userLocation, mapCenter]);

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
    if (!db || !user?.uid) return;
    try {
        const partyRef = db.collection('parties').doc(partyId);
        const chatRef = db.collection('chats').doc(partyId);

        await db.runTransaction(async (transaction) => {
            const partyDoc = await transaction.get(partyRef);
            if (!partyDoc.exists) {
                throw "Party does not exist!";
            }

            const currentPlayers = partyDoc.data()?.playersCurrent || 0;

            transaction.update(partyRef, {
                members: firebase.firestore.FieldValue.arrayUnion(user.username),
                playersCurrent: currentPlayers + 1
            });

            transaction.update(chatRef, {
                members: firebase.firestore.FieldValue.arrayUnion(user.uid)
            });
        });

    } catch (error) {
        console.error("Error joining party and chat:", error);
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

  // Handle "Go Live" Toggle (Now via PlaySportModal)
  const handleToggleBroadcast = async (sport: SportType) => {
    if (!authUser) return;
    const newStatus = !isLive;
    setIsLive(newStatus);
    setBroadcastingSport(newStatus ? sport : undefined);
    
    // Immediate update
    const lat = userLocation?.lat || mapCenter.lat;
    const lng = userLocation?.lng || mapCenter.lng;

    await updateLocation(
      authUser.uid,
      lat,
      lng,
      newStatus ? 'live' : 'static',
      newStatus,
      newStatus ? sport : undefined
    );
  };

  // Handle Discovery (Now via PlaySportModal)
  const handleFindPlayers = async (sport: SportType, count: number) => {
    setIsDiscovering(true);
    try {
      const results = await discoverUsers(mapCenter.lat, mapCenter.lng, 5000, sport, count); // 5km radius
      setDiscoveredUsers(results);
    } catch (error) {
      console.error("Discovery failed", error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddFriend = async (friendUsername: string) => {
    if (!authUser || !db) return;
    if (friendUsername === user.username) {
      alert("You can't add yourself as a friend.");
      return;
    }

    try {
      // 1. Find the user by username
      const usersRef = db.collection('users');
      const querySnapshot = await usersRef.where('username', '==', friendUsername).limit(1).get();

      if (querySnapshot.empty) {
        alert('User not found.');
        return;
      }

      const friendDoc = querySnapshot.docs[0];
      const friendId = friendDoc.id;

      // Check if already friends or request sent
      const myFriendDoc = await usersRef.doc(authUser.uid).collection('friends').doc(friendId).get();
      if (myFriendDoc.exists) {
          const status = myFriendDoc.data()?.status;
          if (status === 'accepted' || !status) { // !status for legacy compatibility
              alert('You are already friends!');
              return;
          } else if (status === 'sent') {
              alert('Friend request already sent.');
              return;
          } else if (status === 'pending') {
              alert('This user has already sent you a request. Check your requests tab.');
              return;
          }
      }

      // 2. Add to current user's friend list as 'sent'
      await usersRef.doc(authUser.uid).collection('friends').doc(friendId).set({
          status: 'sent',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 3. Add current user to friend's friend list as 'pending'
      await usersRef.doc(friendId).collection('friends').doc(authUser.uid).set({
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert('Friend request sent!');
    } catch (error) {
      console.error("Error adding friend:", error);
      alert('Failed to send friend request.');
    }
  };

  const handleAcceptFriend = async (friendId: string) => {
    if (!authUser || !db) return;
    try {
        const usersRef = db.collection('users');
        
        // Update my status to 'accepted'
        await usersRef.doc(authUser.uid).collection('friends').doc(friendId).update({
            status: 'accepted',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update friend's status to 'accepted'
        await usersRef.doc(friendId).collection('friends').doc(authUser.uid).update({
            status: 'accepted',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error accepting friend:", error);
    }
  };

  const handleRejectFriend = async (friendId: string) => {
    if (!authUser || !db) return;
    try {
        const usersRef = db.collection('users');
        
        // Delete my doc
        await usersRef.doc(authUser.uid).collection('friends').doc(friendId).delete();

        // Delete friend's doc (which was 'sent')
        await usersRef.doc(friendId).collection('friends').doc(authUser.uid).delete();
    } catch (error) {
        console.error("Error rejecting friend:", error);
    }
  };

  const handleAddVenue = async (venue: Omit<Venue, 'id'>) => {
    await addVenue(venue);
    // Re-fetch venues to update the list
    const venueData = await getVenues();
    setVenues(venueData);
  };

  const handleShareVenue = (venue: Venue) => {
    setVenueToShare(venue);
    setIsSharingVenue(true);
  };

  const handleShareWithFriends = async (selectedFriendIds: string[]) => {
    if (!venueToShare || !authUser || !db) return;

    const message = {
      text: `Check out this venue: ${venueToShare.name}`,
      senderId: authUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: 'venue_share',
      venue: venueToShare,
    };

    try {
      const batch = db.batch();
      selectedFriendIds.forEach(friendId => {
        const chatRoomId = [authUser.uid, friendId].sort().join('_');
        const messageRef = db.collection('chats').doc(chatRoomId).collection('messages').doc();
        batch.set(messageRef, message);
      });

      await batch.commit();
      alert(`Venue shared with ${selectedFriendIds.length} ${selectedFriendIds.length === 1 ? 'friend' : 'friends'}!`)
    } catch (error) {
      console.error("Error sharing venue with friends:", error);
      alert("Failed to share venue.");
    }

    setIsSharingVenue(false);
    setVenueToShare(null);
  };

  const handleViewVenue = (venue: Venue) => {
    setMapCenter({ lat: venue.latitude, lng: venue.longitude });
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
            venues={venuesWithDistance}
            discoveredUsers={discoveredUsers}
            center={mapCenter} 
            currentUser={user.username}
            currentUserUid={authUser?.uid || ''}
            onJoinParty={handleJoinParty}
            isLoaded={isMapsLoaded}
            loadError={mapsLoadError}
            isLive={isLive}
            userLocation={userLocation}
            onShareVenue={handleShareVenue}
            onAddFriend={handleAddFriend}
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

          {/* Recenter Button */}
          <button 
            onClick={handleRecenter}
            className="absolute bottom-44 right-4 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-blue-600 z-[1000] border border-gray-100"
            title="Recenter Map"
          >
            <Crosshair size={24} />
          </button>

          {/* Play Sport Button */}
          <button
            onClick={() => setIsPlaySportModalOpen(true)}
            className="absolute bottom-24 right-4 bg-blue-600 text-white px-6 py-4 rounded-full shadow-xl shadow-blue-600/30 font-bold text-lg hover:bg-blue-700 hover:scale-105 transition-all z-[1000] flex items-center gap-2"
          >
            <Activity size={24} />
            Play Sport
          </button>
          
          <PlaySportModal
            isOpen={isPlaySportModalOpen}
            onClose={() => setIsPlaySportModalOpen(false)}
            isBroadcasting={isLive}
            onToggleBroadcast={handleToggleBroadcast}
            onFindPlayers={handleFindPlayers}
            currentSport={broadcastingSport}
          />
        </>
      )}

      {/* Overlay Views */}
      {currentTab === 'create' && (
        <CreatePartyView 
          onClose={() => setCurrentTab('explore')} 
          onCreate={handleCreateParty}
          userLocation={mapCenter}
          currentUser={user}
          isLoaded={isMapsLoaded}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView 
          user={user}
          onUpdateUser={() => {}} 
          onClose={() => setCurrentTab('explore')}
          onLogout={handleLogout}
          onOpenVenueAdmin={() => setIsVenueAdminOpen(true)}
        />
      )}

      {isVenueAdminOpen && (
        <VenueAdminView 
          onClose={() => setIsVenueAdminOpen(false)}
          onAddVenue={handleAddVenue}
        />
      )}

      {isVenueAdminOpen && (
        <VenueAdminView 
          onClose={() => setIsVenueAdminOpen(false)}
          onAddVenue={handleAddVenue}
        />
      )}

      {/* Chat Views */}
      {isSharingVenue && (
        <UserSelectionView 
          friends={friends}
          onShare={handleShareWithFriends}
          onClose={() => setIsSharingVenue(false)}
        />
      )}

      {currentTab === 'chat' && (
        <div className="absolute inset-0 bottom-[72px] z-[1000] bg-white">
            {selectedChatUser ? (
                <ChatDetailView 
                    chatUser={selectedChatUser} 
                    currentUser={user}
                    onBack={() => setSelectedChatUser(null)} 
                    onViewVenue={handleViewVenue}
                />
            ) : (
                <ChatListView 
                    friends={friends}
                    friendRequests={friendRequests}
                    currentUser={user}
                    onAddFriend={handleAddFriend}
                    onAcceptFriend={handleAcceptFriend}
                    onRejectFriend={handleRejectFriend}
                    onSelectChat={setSelectedChatUser} 
                />
            )}
        </div>
      )}

      {/* Bottom Navigation */}
      {!selectedChatUser && <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />}

    </div>
  );
}

export default App;
