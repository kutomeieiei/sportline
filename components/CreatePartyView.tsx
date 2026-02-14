
import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { Party, SportType } from '../types';
import { SPORTS_LIST, KHON_KAEN_CENTER, DEFAULT_CITY } from '../constants';
import { X, MapPin, Calendar, Clock, Users, Loader2 } from 'lucide-react';

// Declare google global to avoid TS namespace errors
declare var google: any;

interface CreatePartyViewProps {
  onClose: () => void;
  onCreate: (party: Party) => void;
  userLocation: { lat: number; lng: number };
  currentUser: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '240px',
  borderRadius: '16px'
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
};

// --- MODULAR SUB-COMPONENTS ---

const LocationSection: React.FC<{
  location: { lat: number; lng: number };
  setLocation: (loc: { lat: number; lng: number }) => void;
  cityName: string;
  apiKey: string;
}> = ({ location, setLocation, cityName, apiKey }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const handleMapClick = useCallback((e: any) => {
    if (e.latLng) {
      setLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, [setLocation]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-800 uppercase tracking-wide">Location Selection</label>
        <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
          <MapPin size={14} />
          {cityName}
        </div>
      </div>
      
      <div className="relative border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-gray-50">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={location}
            zoom={14}
            options={mapOptions}
            onClick={handleMapClick}
          >
            <MarkerF 
              position={location} 
              draggable={true}
              onDragEnd={(e) => e.latLng && setLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
            />
          </GoogleMap>
        ) : (
          <div style={mapContainerStyle} className="flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-xl text-[10px] text-gray-500 font-mono shadow-sm">
          Fuzzed Coords: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
      </div>
      <p className="text-[11px] text-gray-400 italic">Privacy: Coordinates are stored with random fuzzing for your protection.</p>
    </div>
  );
};

const SportSelectionSection: React.FC<{
  selectedSport: SportType;
  setSelectedSport: (sport: SportType) => void;
}> = ({ selectedSport, setSelectedSport }) => {
  return (
    <div className="space-y-4">
      <label className="text-sm font-bold text-gray-800 uppercase tracking-wide">Sport Category</label>
      <div className="grid grid-cols-4 gap-3">
        {SPORTS_LIST.map((sport) => {
          const isSelected = selectedSport === sport.type;
          return (
            <button
              key={sport.type}
              type="button"
              onClick={() => setSelectedSport(sport.type)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 aspect-square
                ${isSelected 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg transform scale-105' 
                  : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:bg-gray-50'}`}
            >
              <div className="mb-2">
                {sport.icon}
              </div>
              <span className="text-[10px] font-bold text-center leading-tight">
                {sport.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const CreatePartyView: React.FC<CreatePartyViewProps> = ({ onClose, onCreate, currentUser }) => {
  const rawApiKey = ((import.meta as any).env && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY) || '';
  const apiKey = rawApiKey.replace(/['"]/g, '').trim();

  // Centralized State Management (simulating useForm pattern)
  const [form, setForm] = useState({
    title: '',
    sport: 'Football' as SportType,
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '20:00',
    playersMax: 10,
    location: KHON_KAEN_CENTER,
    cityName: DEFAULT_CITY
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Privacy Logic: Inject 50-100m of random noise into coordinates
    const fuzz = () => (Math.random() - 0.5) * 0.001; 
    
    const newParty: Party = {
      id: Date.now().toString(),
      title: form.title,
      sport: form.sport,
      description: form.description,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      playersCurrent: 1,
      playersMax: form.playersMax,
      latitude: form.location.lat + fuzz(),
      longitude: form.location.lng + fuzz(),
      host: currentUser,
      members: [currentUser]
    };
    onCreate(newParty);
  };

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div>
           <h2 className="text-2xl font-black text-gray-900 leading-none tracking-tighter uppercase">Host Game</h2>
           <p className="text-xs text-blue-600 font-bold tracking-widest uppercase mt-0.5">Matchmaker v2026</p>
        </div>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32 no-scrollbar">
        <form id="create-party-form" onSubmit={handleSubmit} className="space-y-10 max-w-xl mx-auto">
          
          <LocationSection 
            location={form.location}
            setLocation={(loc) => setForm({...form, location: loc})}
            cityName={form.cityName}
            apiKey={apiKey}
          />

          <SportSelectionSection 
            selectedSport={form.sport}
            setSelectedSport={(s) => setForm({...form, sport: s})}
          />

          {/* Details Section */}
          <div className="space-y-6 pt-4 border-t border-gray-100">
             <label className="text-sm font-bold text-gray-800 uppercase tracking-wide">Match Intelligence</label>
             
             <div className="space-y-1">
                <input 
                  required
                  type="text" 
                  placeholder="Match Title (e.g., Casual 5v5 @ KKU)"
                  className="w-full p-5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-lg"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                />
             </div>

             <div>
                <textarea 
                  rows={3}
                  placeholder="Semantic Bio: Describe play style, intent, or equipment needs. Gemini will use this for smart matching."
                  className="w-full p-5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition-all resize-none font-medium text-sm"
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                   <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                   <input 
                      required
                      type="date" 
                      className="w-full pl-12 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white text-sm font-bold"
                      value={form.date}
                      onChange={(e) => setForm({...form, date: e.target.value})}
                   />
                </div>
                
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                      <input 
                        required
                        type="time" 
                        className="w-full pl-12 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white text-sm font-bold"
                        value={form.startTime}
                        onChange={(e) => setForm({...form, startTime: e.target.value})}
                      />
                   </div>
                   <div className="relative flex-1">
                      <input 
                        required
                        type="time" 
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white text-sm font-bold"
                        value={form.endTime}
                        onChange={(e) => setForm({...form, endTime: e.target.value})}
                      />
                   </div>
                </div>
             </div>

             <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-100 rounded-2xl text-blue-600 shadow-sm">
                      <Users size={24} />
                   </div>
                   <div>
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Roster Size</p>
                      <p className="text-sm font-medium text-blue-900">Maximum Athletes</p>
                   </div>
                </div>
                <input 
                  type="number" 
                  min="2"
                  max="50"
                  className="w-20 bg-white border border-blue-200 rounded-2xl py-3 text-center font-black text-blue-900 text-xl outline-none focus:border-blue-500 shadow-sm"
                  value={form.playersMax}
                  onChange={(e) => setForm({...form, playersMax: parseInt(e.target.value)})}
                />
             </div>
          </div>
        </form>
      </div>

      {/* Footer CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 pb-10">
        <button 
          type="submit" 
          form="create-party-form"
          className="w-full bg-blue-600 text-white font-black text-xl py-5 rounded-3xl shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          Publish Match
        </button>
      </div>
    </div>
  );
};

export default CreatePartyView;
