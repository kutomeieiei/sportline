import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import MapView from './components/MapView';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import NewGameSheet from './components/NewGameSheet';
import UserProfileSheet, { ProfileTarget } from './components/UserProfileSheet';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ChatListView, { ChatUser } from './components/ChatListView';
import ChatDetailView from './components/ChatDetailView';
import CallProvider from './components/CallProvider';
import { recordMessage, directChatId } from './services/chatMeta';
import { Party, SportType, User, DiscoveryResult, Venue } from './types';
import { INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Loader2, Radio, Search, X, Users, MessageCircle, MousePointerClick, MapPin } from 'lucide-react';
import ShareLocationCard from './components/ShareLocationCard';
import { isTouchDevice } from './utils/device';
import { auth, db, firebase } from './firebase'; // Import firebase for compat utilities
import { User as FirebaseUser } from 'firebase/auth';
import { calculateHaversineDistance } from './utils/geospatial';
import { discoverUsers } from './services/discoveryService';
import { updateLocation } from './services/locationService';
import { getVenues, addVenue, mergeWithBuiltInVenues } from './services/venueService';
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

  const [currentTab, setCurrentTab] = useState<'explore' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  // "Start a group here" from a venue: the new-message sheet opens for this venue.
  const [composeVenue, setComposeVenue] = useState<Venue | null>(null);
  // "Share my location" card on the map.
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [hasRealLocation, setHasRealLocation] = useState(false);
  // A party to open on the map (e.g. after tapping someone's note in Chat).
  const [focusPartyId, setFocusPartyId] = useState<string | null>(null);
  // Whose profile page is open (from the map, a party, or a chat).
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);
  // Spot picked on the map for a new game (opens Create with it filled in).
  const [createAt, setCreateAt] = useState<{ lat: number; lng: number; placeName?: string } | null>(null);
  // One-time tip about clicking the map, hidden once dismissed.
  const [showMapTip, setShowMapTip] = useState(() => {
    try { return localStorage.getItem('ss-map-tip-seen') !== '1'; } catch { return true; }
  });
  const dismissMapTip = () => {
    setShowMapTip(false);
    try { localStorage.setItem('ss-map-tip-seen', '1'); } catch { /* private mode */ }
  };

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
  // Last position sent while sharing location.
  const lastSharedPos = useRef<{ lat: number; lng: number } | null>(null);

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

  // If I was still sharing my location when I last closed the app, show that
  // (so I can see it and stop it), instead of silently staying visible.
  useEffect(() => {
    if (!isAuthenticated || !authUser || !db) return;
    db.collection('active_locations').doc(authUser.uid).get().then((snap) => {
      const d = snap.data();
      if (!d || d.vis !== true) return;
      const t = d.t?.toMillis?.() ?? 0;
      if (Date.now() - t > 60 * 60_000) return; // too old: nobody can see it anyway
      lastSharedPos.current = Array.isArray(d.l) ? { lat: d.l[0], lng: d.l[1] } : null;
      setIsLive(true);
      setBroadcastingSport((d.sport as SportType) || 'All');
    }).catch(() => {});
  }, [isAuthenticated, authUser]);

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
          lastSharedPos.current = newPos;

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

    // Found-players lists hide people whose location is over an hour old, so
    // refresh it every few minutes even when you're standing still.
    const refresh = setInterval(() => {
      const pos = lastSharedPos.current;
      if (pos) updateLocation(authUser.uid, pos.lat, pos.lng, 'live', true).catch(console.error);
    }, 5 * 60_000);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      clearInterval(refresh);
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

  // Admin venues + popular places around KKU; with a sport chip picked, only places for that sport.
  const venuesWithDistance = useMemo(() => {
    const calculationCenter = userLocation || mapCenter;
    const all = mergeWithBuiltInVenues(venues)
      .filter((v) => selectedSport === 'All' || v.courts.some((c) => c.sport === selectedSport));
    return all.map(venue => ({
      ...venue,
      distance: calculateHaversineDistance(
        calculationCenter.lat,
        calculationCenter.lng,
        venue.latitude,
        venue.longitude
      )
    }));
  }, [venues, userLocation, mapCenter, selectedSport]);

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

  const handleTabChange = (tab: 'explore' | 'settings' | 'chat') => {
    setCurrentTab(tab);
    setCreateAt(null);
    if (tab !== 'chat') {
        setSelectedChatUser(null);
    }
  };

  const handleCreateParty = (newParty: Party) => {
    setCurrentTab('explore');
    setCreateAt(null);
    setSelectedSport('All');
    setFocusPartyId(newParty.id);
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

  const handleLeaveParty = async (partyId: string) => {
    if (!db || !user?.uid) return;
    try {
      const partyRef = db.collection('parties').doc(partyId);
      const chatRef = db.collection('chats').doc(partyId);
      await db.runTransaction(async (transaction) => {
        const partyDoc = await transaction.get(partyRef);
        if (!partyDoc.exists) throw "This game no longer exists.";
        const data = partyDoc.data() || {};
        if (!(data.members || []).includes(user.username)) throw "You're not in this game.";
        transaction.update(partyRef, {
          members: firebase.firestore.FieldValue.arrayRemove(user.username),
          playersCurrent: Math.max(0, (data.playersCurrent || 1) - 1),
        });
      });
      // Also leave the game's group chat (if there is one).
      await chatRef.update({ members: firebase.firestore.FieldValue.arrayRemove(user.uid) }).catch(() => {});
    } catch (error) {
      console.error('Error leaving party:', error);
      alert(typeof error === 'string' ? error : "Couldn't leave this game. Please try again.");
    }
  };

  const handleOpenPartyChat = (party: Party) => {
    setSelectedChatUser({
      id: party.id,
      name: party.title,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(party.title)}&background=random`,
      isGroup: true,
    });
    setCurrentTab('chat');
  };

  // "Share location": find where I am, then show the share card there.
  const openShareCard = () => {
    setIsShareCardOpen(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(pos);
        setHasRealLocation(true);
        setMapCenter(pos);
      },
      () => setHasRealLocation(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
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
  // Share my location as "up for" a sport ("All" = any sport). Calling it again changes the sport.
  const startSharing = async (sport: SportType) => {
    if (!authUser) return;
    const pos = userLocation || mapCenter;
    lastSharedPos.current = pos;
    try {
      await updateLocation(authUser.uid, pos.lat, pos.lng, 'live', true, sport);
      setIsLive(true);
      setBroadcastingSport(sport);
    } catch (e) {
      console.error('Could not share location', e);
      alert("Couldn't share your location. Please try again.");
    }
  };

  const stopSharing = async () => {
    if (!authUser) return;
    const pos = lastSharedPos.current || userLocation || mapCenter;
    setIsLive(false);
    setBroadcastingSport(undefined);
    await updateLocation(authUser.uid, pos.lat, pos.lng, 'static', false).catch(console.error);
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

  // Tapping a note in Chat: show that party on the map, with its details open.
  const handleOpenParty = (party: Party) => {
    setSelectedSport('All');
    setMapCenter({ lat: party.latitude, lng: party.longitude });
    setFocusPartyId(party.id);
    setSelectedChatUser(null);
    setCurrentTab('explore');
  };

  // "Message" on a profile: open (or start) the 1-to-1 chat.
  const handleMessageUser = (u: User) => {
    const name = u.display_name || u.displayName || u.username || 'Player';
    setProfileTarget(null);
    setCreateAt(null);
    setSelectedChatUser({
      id: u.uid,
      name,
      username: u.username,
      avatarUrl: u.profile_img_url || u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      isGroup: false,
      isOnline: u.isOnline,
    });
    setCurrentTab('chat');
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
      {/* Everything except the menu: above the phone bottom bar, right of the PC side menu */}
      <main className="absolute inset-0 bottom-[72px] md:bottom-0 md:left-20">

      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapView 
            focusPartyId={focusPartyId}
            onFocusHandled={() => setFocusPartyId(null)}
            onCreateAt={(loc, placeName) => { dismissMapTip(); setCreateAt({ ...loc, placeName }); }}
            onOpenProfile={setProfileTarget}
            onStartGroupAt={(venue) => {
              setComposeVenue(venue);
              setSelectedChatUser(null);
              setCurrentTab('chat');
              setIsComposeOpen(true);
            }}
            onLeaveParty={handleLeaveParty}
            active={currentTab === 'explore'}
            onOpenPartyChat={handleOpenPartyChat}
            shareCard={currentTab === 'explore' && isShareCardOpen ? {
              position: userLocation || mapCenter,
              onClose: () => setIsShareCardOpen(false),
              content: (
                <ShareLocationCard
                  name={user.display_name || user.displayName || user.username || 'You'}
                  avatar={user.profile_img_url || user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'Me')}&background=random`}
                  isLive={isLive}
                  liveSport={broadcastingSport}
                  usingMapCenter={!hasRealLocation && !userLocation}
                  onStart={startSharing}
                  onStop={stopSharing}
                />
              ),
            } : null}
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

          {/* Share location + Find friends (floating buttons) */}
          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-3 animate-in fade-in slide-in-from-bottom">
            <button
              onClick={openShareCard}
              aria-pressed={isLive}
              className="ripple press h-12 pl-4 pr-5 rounded-2xl bg-white text-gray-900 shadow-elev-2 hover:bg-gray-50 font-medium text-[15px] flex items-center gap-2"
            >
              {isLive ? (
                <span className="relative flex w-3 h-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-3 h-3 bg-green-500" />
                </span>
              ) : <MapPin size={20} className="text-red-600" />}
              <span>{isLive ? 'Sharing location' : 'Share location'}</span>
            </button>
            <button
              onClick={() => setIsPlaySportModalOpen(true)}
              className="ripple press h-14 pl-4 pr-5 rounded-2xl bg-red-600 text-white shadow-elev-3 hover:bg-red-700 font-medium text-[15px] flex items-center gap-2"
            >
              <Search size={20} />
              <span>Find friends</span>
            </button>
          </div>

          {/* Tip: how to plan a game on the map (until dismissed or used) */}
          {showMapTip && !isLiveSearchEnabled && (
            <div className="absolute bottom-4 left-4 right-44 sm:right-auto sm:max-w-xs z-[1000] flex items-start gap-2 p-3 rounded-2xl bg-white shadow-elev-2 text-[13px] text-gray-700 animate-in fade-in slide-in-from-bottom">
              <MousePointerClick size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="flex-1">
                {isTouchDevice()
                  ? <>Tap the map to plan a game there. Drag to move the map, pinch to zoom.</>
                  : <>Click the map to plan a game there. Drag with the right mouse button to move the map.</>}
              </p>
              <button onClick={dismissMapTip} aria-label="Dismiss tip" className="text-gray-400 hover:text-gray-700 shrink-0">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Live search controls */}
          {isLiveSearchEnabled && (
            <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-[1000] animate-in fade-in slide-in-from-left">
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
            onFindPlayers={handleFindPlayers}
          />

          <DiscoveredUsersSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            discoveredUsers={discoveredUsers}
          />
        </>
      )}

      {/* Overlay Views */}
      {profileTarget && (
        <UserProfileSheet
          key={profileTarget.uid}
          {...profileTarget}
          myUid={authUser?.uid || user.uid}
          parties={parties}
          onClose={() => setProfileTarget(null)}
          onAddFriend={handleAddFriend}
          onAcceptFriend={handleAcceptFriend}
          onMessage={handleMessageUser}
          onOpenParty={(p) => { setProfileTarget(null); handleOpenParty(p); }}
        />
      )}

      {createAt && (
        <NewGameSheet
          key={`${createAt.lat},${createAt.lng}`}
          location={createAt}
          placeName={createAt.placeName}
          currentUser={{ ...user, uid: authUser?.uid || user.uid }}
          onClose={() => setCreateAt(null)}
          onCreated={handleCreateParty}
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
        <div className="absolute inset-0 z-[1000] bg-white flex">
          {/* Chat list: full screen on phones, left column on PC */}
          <div className={`${selectedChatUser ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] lg:w-[400px] shrink-0 md:border-r border-gray-200 min-h-0`}>
            <ChatListView
              friends={friends}
              friendRequests={friendRequests}
              currentUser={{ ...user, uid: authUser?.uid || user.uid }}
              parties={parties}
              selectedChatId={selectedChatUser?.id}
              isComposeOpen={isComposeOpen}
              onComposeOpenChange={(open) => { setIsComposeOpen(open); if (!open) setComposeVenue(null); }}
              onAddFriend={handleAddFriend}
              onAcceptFriend={handleAcceptFriend}
              onRejectFriend={handleRejectFriend}
              onSelectChat={setSelectedChatUser}
              onOpenParty={handleOpenParty}
              onPlanParty={() => { handleTabChange('explore'); setShowMapTip(true); }}
              composeVenue={composeVenue}
            />
          </div>

          {/* Open chat: full screen on phones, right side on PC */}
          {selectedChatUser ? (
            <div className="fixed inset-0 z-[2000] md:static md:z-auto flex-1 min-w-0 flex">
              <ChatDetailView
                key={`${selectedChatUser.isGroup ? 'g' : 'u'}_${selectedChatUser.id}`}
                chatUser={selectedChatUser}
                currentUser={user}
                friends={friends}
                onBack={() => setSelectedChatUser(null)}
                onViewVenue={handleViewVenue}
                onOpenProfile={(uid) => setProfileTarget({ uid })}
                onAddFriend={handleAddFriend}
                onAcceptFriend={handleAcceptFriend}
              />
            </div>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center px-6 animate-in fade-in">
              <span className="w-24 h-24 rounded-full border-2 border-gray-900 flex items-center justify-center">
                <MessageCircle size={44} strokeWidth={1.5} className="text-gray-900" />
              </span>
              <p className="mt-4 text-xl font-semibold text-gray-900">Your messages</p>
              <p className="mt-1 text-sm text-gray-500">Send a message to a friend or group.</p>
              <button
                onClick={() => setIsComposeOpen(true)}
                className="ripple press mt-4 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                Send message
              </button>
            </div>
          )}
        </div>
      )}

      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={handleTabChange}
        chatBadge={unreadTotal + friendRequests.length}
        hideOnMobile={currentTab === 'chat' && !!selectedChatUser}
      />

    </div>
    </CallProvider>
  );
}

export default App;
