import React, { useState, useEffect, useMemo } from 'react';
// import Map from './components/Map';
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
import { auth } from './services/firebaseService';
// import { rankUsers, RankedUser } from './services/rankingService';
import { useAuth } from './hooks/useAuth';
import { useUserProfile } from './hooks/useUserProfile';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDiscovery } from './hooks/useDiscovery';
import { useDebounce } from './hooks/useDebounce';

// Initialize QueryClient
const queryClient = new QueryClient();

export default function App() {
  // --- STATE ---
  const [currentView, setCurrentView] = useState<'map' | 'chats' | 'profile'>('map');
  const [showCreateParty, setShowCreateParty] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatUser | null>(null);
  
  // Map & Location State
  const [mapCenter, setMapCenter] = useState(constants.DEFAULT_CENTER);
  const [searchRadius, setSearchRadius] = useState(5000); // Default 5km
  const debouncedMapCenter = useDebounce(mapCenter, 500); // Debounce map moves
  const debouncedRadius = useDebounce(searchRadius, 500);

  // Filter State
  const [selectedSport, setSelectedSport] = useState<SportType>('All');

  // Auth & User State
  const { authUser, isLoadingAuth, isAuthenticated } = useAuth();
  const { user, setUser, isServerDataLoaded } = useUserProfile(authUser);

  // Data Fetching (Discovery)
  const { data: discoveryData, isLoading: isLoadingDiscovery } = useDiscovery(
    debouncedMapCenter.lat, 
    debouncedMapCenter.lng, 
    debouncedRadius
  );

  // AI Ranking State
  const [isRanking, setIsRanking] = useState(false);
  // const [rankedResults, setRankedResults] = useState<RankedUser[] | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);

  // Rate limiting for distance matrix
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // --- DERIVED STATE ---
  const parties = useMemo(() => {
     return discoveryData?.parties || constants.INITIAL_PARTIES;
  }, [discoveryData]);

  const sortedParties = useMemo(() => {
    let filtered = parties;
    
    // 1. Filter by Sport
    if (selectedSport !== 'All') {
      filtered = filtered.filter(p => p.sport === selectedSport);
    }

    // 2. Sort by Date/Time (Soonest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [parties, selectedSport]);


  // --- HANDLERS ---

  const handleCreateParty = (newParty: Party) => {
    // In a real app, React Query would handle cache invalidation
    // For now, we rely on the optimistic update in CreatePartyView calling onCreate
    // But actually CreatePartyView calls onCreate with the new party
    // We should probably update the local cache or refetch
    queryClient.invalidateQueries({ queryKey: ['discovery'] });
    setShowCreateParty(false);
  };

  const handleUpdateUser = (updatedUser: typeof user) => {
    setUser(updatedUser);
  };

  const handleFindPartners = async () => {
    setIsRanking(true);
    setShowRankingModal(true);
    
    // Use DUMMY_USERS for demonstration, in real app fetch from Firestore
    // const results = await rankUsers(user, constants.DUMMY_USERS, mapCenter);
    // setRankedResults(results);
    setIsRanking(false);
  };

  const handleLogout = async () => {
      await auth.signOut();
      // State will update via useAuth listener
  };

  // --- RENDER ---

  if (isLoadingAuth || !isServerDataLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-400 text-sm font-medium">Syncing with server...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={(u) => setUser(u)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-full h-screen flex flex-col bg-white overflow-hidden relative font-sans">
      
      {/* Top Bar */}
      <TopBar 
        user={user} 
        onOpenSettings={() => setShowSettings(true)}
        selectedSport={selectedSport}
        onSelectSport={setSelectedSport}
      />

      {/* Map Layer */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        {/* <Map 
            parties={sortedParties} 
            users={constants.DUMMY_USERS} // Pass dummy users for visualization
            center={mapCenter} 
            onCameraIdle={(center) => {
              setMapCenter(center);
            }}
        /> */}
        <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
            Map Disabled for Debugging
        </div>
      </div>

      {/* Floating UI Elements */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="w-full h-full relative">
            
            {/* AI Matchmaking Button */}
            <button 
                onClick={handleFindPartners}
                className="absolute top-24 right-4 pointer-events-auto bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-violet-100 text-violet-600 hover:bg-violet-50 transition-all active:scale-95"
            >
                <Sparkles size={24} />
            </button>

            {/* Current Location Button */}
            <button 
                onClick={() => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                            setMapCenter({
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude
                            });
                        });
                    }
                }}
                className="absolute bottom-24 right-4 pointer-events-auto bg-white p-3 rounded-full shadow-lg border border-gray-100 text-gray-700 hover:bg-gray-50 active:scale-95"
            >
                <Crosshair size={24} />
            </button>
        </div>
      </div>

      {/* Views Overlay (Chats, etc) */}
      {currentView === 'chats' && (
        <div className="absolute inset-0 z-20 bg-white animate-in slide-in-from-right duration-300">
            {selectedChat ? (
                <ChatDetailView 
                    chat={selectedChat} 
                    onBack={() => setSelectedChat(null)} 
                    currentUser={user}
                />
            ) : (
                <ChatListView onSelectChat={setSelectedChat} />
            )}
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onCreateParty={() => setShowCreateParty(true)}
      />

      {/* Modals */}
      {showCreateParty && (
        <CreatePartyView 
          onClose={() => setShowCreateParty(false)} 
          onCreate={handleCreateParty}
          userLocation={mapCenter}
          currentUser={user.uid}
        />
      )}

      {showSettings && (
        <SettingsView 
          user={user} 
          onUpdateUser={handleUpdateUser} 
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
        />
      )}

      {/* AI Ranking Modal */}
      {showRankingModal && (
            <div className="fixed inset-0 bg-black/50 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-white w-full sm:max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-violet-600">
                            <Sparkles size={20} />
                            <h2 className="font-bold text-lg">AI Partner Match</h2>
                        </div>
                        <button onClick={() => setShowRankingModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                            <X size={20} className="text-gray-500" />
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
    </div>
    </QueryClientProvider>
  );
}
