import React, { useState } from 'react';
import MapView from './components/MapView';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CreatePartyView from './components/CreatePartyView';
import SettingsView from './components/SettingsView';
import { Party, SportType, User } from './types';
import { INITIAL_PARTIES, INITIAL_USER, DEFAULT_CENTER } from './constants';
import { Crosshair } from 'lucide-react';

function App() {
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>(INITIAL_PARTIES);
  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings'>('explore');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  // Filter parties based on selection
  const filteredParties = selectedSport === 'All' 
    ? parties 
    : parties.filter(p => p.sport === selectedSport);

  const handleTabChange = (tab: 'explore' | 'create' | 'settings') => {
    setCurrentTab(tab);
  };

  const handleCreateParty = (newParty: Party) => {
    setParties([...parties, newParty]);
    setCurrentTab('explore');
    // Center map on new party
    setMapCenter({ lat: newParty.latitude, lng: newParty.longitude });
  };

  const handleRecenter = () => {
    // In a real app, this would use navigator.geolocation
    // For demo, we just reset to default or jitter slightly to show effect
    setMapCenter({ ...DEFAULT_CENTER, lat: DEFAULT_CENTER.lat + (Math.random() * 0.001) });
  };
  
  const handleLocationSelect = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
      
      {/* Map Layer (Always rendered in background) */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <MapView parties={filteredParties} center={mapCenter} />
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
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />

    </div>
  );
}

export default App;