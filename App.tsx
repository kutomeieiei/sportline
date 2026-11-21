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
import CallProvider from './components/CallProvider';
import { recordMessage, directChatId } from './services/chatMeta';
import { Party, SportType, User, DiscoveryResult, Venue } from './types';
import { INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Crosshair, Loader2, Radio, Search, Activity, X, Users } from 'lucide-react';
import { auth, db, firebase } from './firebase'; // Import firebase for compat utilities
import { User as FirebaseUser } from 'firebase/auth';
import { calculateHaversineDistance } from './utils/geospatial';
import { discoverUsers } from './services/discoveryService';
import { updateLocation } from './services/locationService';
import { getVenues, addVenue } from './services/venueService';
import VenueAdminView from './components/VenueAdminView';
import PlaySportModal from './components/PlaySportModal';
import UserSelectionView from './components/UserSelectionView';
import SportAdminView from './components/SportAdminView';
import DiscoveredUsersSidebar from './components/DiscoveredUsersSidebar';
import { getSportConfigs } from './services/sportService';
import { SportConfig } from './types';

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
  const [isLiveSearchEnabled, setIsLiveSearchEnabled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveSearchSport, setLiveSearchSport] = useState<SportType>('All');
  const [liveSearchCount, setLiveSearchCount] = useState<number>(4);
  const [isVenueAdminOpen, setIsVenueAdminOpen] = useState(false);
  const [isSportAdminOpen, setIsSportAdminOpen] = useState(false);
  const [isSharingVenue, setIsSharingVenue] = useState(false);
  const [venueToShare, setVenueToShare] = useState<Venue | null>(null);
  const [isPlaySportModalOpen, setIsPlaySportModalOpen] = useState(false);
  const [broadcastingSport, setBroadcastingSport] = useState<SportType | undefined>(undefined);
  const [sportConfigs, setSportConfigs] = useState<SportConfig[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

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
      // Only Google accounts are allowed. Sign out any old email/password session.
      if (currentUser && !currentUser.providerData.some(p => p?.providerId === 'google.com')) {
        auth.signOut();
        return;
      }
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

  // --- Admin check: admins are listed in the `admins` collection (edited only in Firebase Console) ---
  useEffect(() => {
    if (!authUser || !db) {
      setIsAdmin(false);
      return;
    }
    db.collection('admins').doc(authUser.uid).get()
      .then(snap => setIsAdmin(snap.exists))
      .catch(() => setIsAdmin(false));
  }, [authUser]);

  // --- Unread messages across all chats (red badge on the Chat tab) ---
  useEffect(() => {
    if (!authUser || !db) { setUnreadTotal(0); return; }
    return db.collection('chats').where('members', 'array-contains', authUser.uid).onSnapshot((snap) => {
      let total = 0;
      snap.docs.forEach((d) => { total += Number(d.data().unread?.[authUser.uid] || 0); });
      setUnreadTotal(total);
    }, () => setUnreadTotal(0));
  }, [authUser]);

  // Show unread count in the browser tab title, like most chat apps.
  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) SportSphere` : 'SportSphere';
  }, [unreadTotal]);

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

  // --- Fetch Venues & Sports (One-time) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchInitialData = async () => {
        const venueData = await getVenues();
        setVenues(venueData);
        const sportData = await getSportConfigs();
        setSportConfigs(sportData);
    };

    fetchInitialData();
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

  // Live Search Loop
  useEffect(() => {
    if (!isAuthenticated || !authUser || !isLiveSearchEnabled) return;

    const performSearch = async () => {
      try {
        const results = await discoverUsers(mapCenter.lat, mapCenter.lng, 5000, liveSearchSport, liveSearchCount);
        const filteredResults = results.filter(r => r.uid !== authUser.uid);
        setDiscoveredUsers(filteredResults);
      } catch (error) {
        console.error("Live discovery failed", error);
      }
    };

    // Initial search
    performSearch();

    // Poll every 10 seconds
    const intervalId = setInterval(performSearch, 10000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, authUser, isLiveSearchEnabled, mapCenter, liveSearchSport, liveSearchCount]);

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

            const partyData = partyDoc.data() || {};
            const currentPlayers = partyData.playersCurrent || 0;
            const members: string[] = partyData.members || [];

            // Don't count the same person twice, and don't go over the limit.
            if (members.includes(user.username)) {
                throw "You already joined this party.";
            }
            if (partyData.playersMax && currentPlayers >= partyData.playersMax) {
                throw "This party is full.";
            }

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
        alert(typeof error === 'string' ? error : "Couldn't join this party. Please try again.");
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
    setLiveSearchSport(sport);
    setLiveSearchCount(count);
    setIsLiveSearchEnabled(true);
    setIsSidebarOpen(true);
    setIsDiscovering(true);
    try {
      const results = await discoverUsers(mapCenter.lat, mapCenter.lng, 5000, sport, count); // 5km radius
      // Filter out the current user
      const filteredResults = results.filter(r => r.uid !== authUser?.uid);
      setDiscoveredUsers(filteredResults);
    } catch (error) {
      console.error("Discovery failed", error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleStopLiveSearch = () => {
    setIsLiveSearchEnabled(false);
    setIsSidebarOpen(false);
    setDiscoveredUsers([]);
  };

  const handleAddFriend = async (usernameOrEmail: string) => {
    if (!authUser || !db) return;
    const input = usernameOrEmail.trim().toLowerCase().replace(/^@/, '');
    const isEmail = input.includes('@');
    if (input === user.username || (isEmail && input === (authUser.email || '').toLowerCase())) {
      alert("You can't add yourself as a friend.");
      return;
    }

    try {
      // 1. Find the user by username, or by Gmail address
      const usersRef = db.collection('users');
      let querySnapshot = await usersRef.where(isEmail ? 'email' : 'username', '==', input).limit(1).get();
      if (querySnapshot.empty && isEmail && input !== usernameOrEmail.trim()) {
        // Emails are saved as Google gives them; try the exact text too.
        querySnapshot = await usersRef.where('email', '==', usernameOrEmail.trim()).limit(1).get();
      }

      if (querySnapshot.empty) {
        alert(isEmail
          ? 'No player found with that Gmail. They need to sign in to SportSphere once first.'
          : 'User not found. Check the username, or try their Gmail address.');
        return;
      }

      const friendDoc = querySnapshot.docs[0];
      const friendId = friendDoc.id;
      if (friendId === authUser.uid) {
        alert("You can't add yourself as a friend.");
        return;
      }

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
        const chatRoomId = directChatId(authUser.uid, friendId);
        const messageRef = db.collection('chats').doc(chatRoomId).collection('messages').doc();
        batch.set(messageRef, message);
      });

      await batch.commit();
      await Promise.all(selectedFriendIds.map(friendId =>
        recordMessage(directChatId(authUser.uid, friendId), [authUser.uid, friendId], authUser.uid, 'venue_share', message.text).catch(() => {})
      ));
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
            <Loader2 className="animate-spin text-red-600" size={36} />
        </div>
     );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (!isServerDataLoaded) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-white">
            <Loader2 className="animate-spin text-red-600 mb-4" size={48} />
            <p className="text-gray-600 text-sm font-medium">Syncing with server...</p>
        </div>
     );
  }

  return (
    <CallProvider currentUser={{ ...user, uid: authUser?.uid || user.uid }}>
    <div className="relative w-full h-screen overflow-hidden bg-white flex flex-col font-sans">
      
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
            sportConfigs={sportConfigs}
        />
      </div>

      {/* Floating UI Elements */}
      {currentTab === 'explore' && (
        <>
          <TopBar 
            selectedSport={selectedSport} 
            onSelectSport={setSelectedSport}
            userAvatar={user.profile_img_url || user.avatarUrl || 'https://i.pravatar.cc/150'}
            onAvatarClick={() => setCurrentTab('settings')}
            onLocationSelect={handleLocationSelect}
            isLoaded={isMapsLoaded}
          />

          {/* My location + Play Sport (Google Maps style floating buttons) */}
          <div className="absolute bottom-[88px] right-4 z-[1000] flex flex-col items-end gap-3 animate-in fade-in slide-in-from-bottom">
            <button
              onClick={handleRecenter}
              aria-label="Show my location"
              title="Show my location"
              className="ripple press w-12 h-12 rounded-full bg-white text-gray-700 shadow-elev-2 hover:bg-gray-50 flex items-center justify-center"
            >
              <Crosshair size={22} />
            </button>
            <button
              onClick={() => setIsPlaySportModalOpen(true)}
              className="ripple press h-14 pl-4 pr-5 rounded-2xl bg-red-600 text-white shadow-elev-3 hover:bg-red-700 font-medium text-[15px] flex items-center gap-2"
            >
              <Activity size={20} />
              <span>Play Sport</span>
            </button>
          </div>

          {/* Live search controls */}
          {isLiveSearchEnabled && (
            <div className="absolute bottom-[88px] left-4 flex flex-col gap-2 z-[1000] animate-in fade-in slide-in-from-left">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="ripple press h-10 px-4 rounded-full bg-white text-gray-800 shadow-elev-2 hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
              >
                <Users size={16} className="text-red-600" />
                <span>Players nearby ({discoveredUsers.length})</span>
              </button>
              <button
                onClick={handleStopLiveSearch}
                className="ripple press h-10 px-4 rounded-full bg-white text-red-700 shadow-elev-2 hover:bg-red-50 text-sm font-medium flex items-center gap-2"
              >
                <X size={16} />
                <span>Stop search</span>
              </button>
            </div>
          )}
          
          <PlaySportModal
            isOpen={isPlaySportModalOpen}
            onClose={() => setIsPlaySportModalOpen(false)}
            isBroadcasting={isLive}
            onToggleBroadcast={handleToggleBroadcast}
            onFindPlayers={handleFindPlayers}
            currentSport={broadcastingSport}
          />

          <DiscoveredUsersSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            discoveredUsers={discoveredUsers}
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
          isAdmin={isAdmin}
          onOpenVenueAdmin={() => setIsVenueAdminOpen(true)}
          onOpenSportAdmin={() => setIsSportAdminOpen(true)}
        />
      )}

      {isAdmin && isVenueAdminOpen && (
        <VenueAdminView 
          onClose={() => setIsVenueAdminOpen(false)}
          onAddVenue={handleAddVenue}
        />
      )}

      {isAdmin && isSportAdminOpen && (
        <SportAdminView 
          onClose={() => setIsSportAdminOpen(false)}
          onUpdate={async () => {
            const sportData = await getSportConfigs();
            setSportConfigs(sportData);
          }}
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
                    friends={friends}
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
      {!selectedChatUser && <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} chatBadge={unreadTotal + friendRequests.length} />}

    </div>
    </CallProvider>
  );
}

export default App;
