import React, { useState, useEffect, useMemo, useRef } from 'react';

import Map from './components/Map';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CreatePartyView from './components/CreatePartyView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ChatListView, { ChatUser } from './components/ChatListView';
import ChatDetailView from './components/ChatDetailView';
import { Party, SportType } from './types';
import * as constants from './constants';
import { Crosshair, Loader2, Sparkles, X } from 'lucide-react';
import { auth } from './services/firebaseService'; // Import firebase for compat utilities


// import { rankUsers, RankedUser } from './services/rankingService';
import { useAuth } from './hooks/useAuth';
import { useUserProfile } from './hooks/useUserProfile';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDiscovery } from './hooks/useDiscovery';
import { useDebounce } from './hooks/useDebounce';





const queryClient = new QueryClient();

function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

function App() {
  const { authUser, isLoadingAuth, isAuthenticated } = useAuth();
  const { user, isServerDataLoaded } = useUserProfile(authUser);
  const [selectedSport, setSelectedSport] = useState<SportType | 'All'>('All');
  const debouncedMapCenter = useDebounce(mapCenter, 500); // 500ms debounce delay
  const { data: discoveredParties } = useDiscovery(debouncedMapCenter.lat, debouncedMapCenter.lng, 10); // 10km radius
  
  // Store travel times separately to avoid re-rendering loops
  const [travelTimes, setTravelTimes] = useState<Record<string, string>>({});

  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(constants.DEFAULT_CENTER);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  // AI Ranking State
  const [isRanking, setIsRanking] = useState(false);
  // const [rankedResults, setRankedResults] = useState<RankedUser[] | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);

  // Rate limiting for distance matrix
  const lastMatrixCall = useRef<number>(0);

  // The new Map component handles its own API provider and loading.

  // Auth logic is now handled by the useAuth hook.

  // User profile logic is now handled by the useUserProfile hook.



  // --- 4. TIER 2: Spatial Refinement (Distance Sorting) ---
  const sortedParties = useMemo(() => {
    if (!discoveredParties) return [];

    const filtered = selectedSport === 'All'
      ? discoveredParties
      : discoveredParties.filter((p: Party) => p.sport === selectedSport);

    // Inject travel time if we have it calculated
    const withTravelTime = filtered.map((party: Party) => ({
      ...party,
      travelTime: travelTimes[party.id],
    }));

    return withTravelTime;
  }, [discoveredParties, selectedSport, travelTimes]);

  // --- 5. TIER 3: Distance Matrix (Travel Time) Logic ---
  useEffect(() => {
    // Only fetch if google maps is loaded and we have parties
    if (typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) return;
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
    }, (response: google.maps.DistanceMatrixResponse | null, status: google.maps.DistanceMatrixStatus) => {
        if (status === 'OK' && response && response.rows[0].elements) {
            const results = response.rows[0].elements;
            const newTimes: Record<string, string> = {};
            
            results.forEach((element: google.maps.DistanceMatrixResponseElement, idx: number) => {
                if (element.status === 'OK' && element.duration) {
                    const partyId = topCandidates[idx].id;
                    newTimes[partyId] = element.duration.text;
                }
            });

            // Update state safely
            setTravelTimes(prev => ({ ...prev, ...newTimes }));
        }
    });

  }, [sortedParties, mapCenter]);

  // Login state is now managed by the useAuth and useUserProfile hooks.

  const handleLogout = async () => {
    if (auth) {
        await auth.signOut();
    }
    setCurrentTab('explore');
    setSelectedChatUser(null);
    // User state is reset by hooks
  };

  const handleFindPartners = async () => {
    setIsRanking(true);
    setShowRankingModal(true);
    
    // Use DUMMY_USERS for demonstration, in real app fetch from Firestore
    // const results = await rankUsers(user, constants.DUMMY_USERS, mapCenter);
    // setRankedResults(results);
    setIsRanking(false);
  };

  if (isLoadingAuth) {
     return (
        <div className="w-full h-screen flex items-center justify-center bg-white">
            <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
     );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (!isServerDataLoaded) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-gray-400 text-sm font-medium">Syncing with server...</p>
        </div>
      );
  }

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



  const handleRecenter = () => {
    // Small jitter to force map refresh if needed
    setMapCenter({ ...constants.DEFAULT_CENTER, lat: constants.DEFAULT_CENTER.lat + (Math.random() * 0.001) });
  };
  
  const handleLocationSelect = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
      
      {/* Map Layer */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <Map 
            parties={sortedParties} 
            users={constants.DUMMY_USERS} // Pass dummy users for visualization
            center={mapCenter} 
            onCameraIdle={(center) => {
              setMapCenter(center);
            }}
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

          {/* AI Matchmaking Button */}
          <button
            onClick={handleFindPartners}
            className="absolute top-24 right-4 bg-white p-3 rounded-full shadow-lg text-violet-600 hover:bg-violet-50 z-[1000] border border-violet-100"
            title="Find Partners with AI"
          >
            <Sparkles size={24} />
          </button>

          <button 
            onClick={handleRecenter}
            className="absolute bottom-24 right-4 bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-blue-600 z-[1000] border border-gray-100"
          >
            <Crosshair size={24} />
          </button>
        </>
      )}

      {/* AI Ranking Modal */}
      {showRankingModal && (
        <div className="absolute inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-violet-50">
                    <div className="flex items-center gap-2 text-violet-700">
                        <Sparkles size={20} />
                        <h2 className="font-bold text-lg">AI Partner Match</h2>
                    </div>
                    <button onClick={() => setShowRankingModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {isRanking ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="animate-spin text-violet-600" size={48} />
                            <p className="text-gray-500 font-medium text-center">
                                Analyzing profiles & location...<br/>
                                <span className="text-xs text-gray-400">Powered by Gemini 2.0 Flash</span>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* {rankedResults && rankedResults.length > 0 ? (
                                rankedResults.map((result) => {
                                    const candidate = constants.DUMMY_USERS.find(u => u.uid === result.uid);
                                    if (!candidate) return null;
                                    
                                    return (
                                        <div key={result.uid} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3">
                                                <div className="relative">
                                                    <img src={candidate.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt={candidate.username} />
                                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                                                        <div className={`w-3 h-3 rounded-full ${candidate.location_mode === 'live' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-bold text-gray-900">{candidate.displayName}</h3>
                                                            <p className="text-xs text-gray-500">@{candidate.username}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                            {result.compatibilityScore}% Match
                                                        </div>
                                                    </div>
                                                    
                                                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg italic">
                                                        "{result.reason}"
                                                    </p>
                                                    
                                                    <div className="flex gap-2 mt-2">
                                                        {candidate.preferredSports.map(s => (
                                                            <span key={s} className="text-[10px] px-1.5 py-0.5 border border-gray-200 text-gray-600 rounded-md">
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No matches found nearby.</p>
                                    <p className="text-xs mt-1">Try expanding your search radius or changing preferences.</p>
                                </div>
                            )} */}
                        </div>
                    )}
                </div>
            </div>
        </div>
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

export default AppWrapper;