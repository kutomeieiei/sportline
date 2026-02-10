import React, { useState, useEffect } from 'react';
import { Party, SportType } from '../types';
import { SPORTS_LIST } from '../constants';
import { X, MapPin, Calendar, Clock, Users, Search, Loader2 } from 'lucide-react';

interface CreatePartyViewProps {
  onClose: () => void;
  onCreate: (party: Party) => void;
  userLocation: { lat: number; lng: number };
  currentUser: string;
}

interface PlaceSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const CreatePartyView: React.FC<CreatePartyViewProps> = ({ onClose, onCreate, userLocation, currentUser }) => {
  const [formData, setFormData] = useState({
    title: '',
    sport: 'Football' as SportType,
    description: '',
    date: '',
    time: '',
    playersMax: 10
  });

  // Location State
  const [locationQuery, setLocationQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(userLocation);
  const [displayLocationName, setDisplayLocationName] = useState('Current Map Center');

  // Debounced search for location
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!locationQuery.trim() || locationQuery.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching locations:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [locationQuery]);

  const handleSelectLocation = (place: PlaceSuggestion) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setSelectedLocation({ lat, lng });
    setDisplayLocationName(place.display_name.split(',')[0]);
    setLocationQuery('');
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParty: Party = {
      id: Date.now().toString(),
      ...formData,
      playersCurrent: 1, // Host is the first player
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      host: currentUser
    };
    onCreate(newParty);
  };

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <h2 className="text-xl font-bold text-gray-800">Create Party</h2>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <X size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <form id="create-party-form" onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Party Title</label>
            <input 
              required
              type="text" 
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="e.g. Friday Night Football"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sport Type</label>
            <div className="grid grid-cols-2 gap-2">
                {SPORTS_LIST.filter(s => s.type !== 'All').map(sport => (
                    <button
                        key={sport.type}
                        type="button"
                        onClick={() => setFormData({...formData, sport: sport.type})}
                        className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all
                            ${formData.sport === sport.type 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {sport.icon}
                        {sport.label}
                    </button>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea 
              rows={3}
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              placeholder="Any specific rules or skill level requirements?"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    required
                    type="date" 
                    className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                </div>
             </div>
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    required
                    type="time" 
                    className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    />
                </div>
             </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Max Players</label>
            <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                type="number" 
                min="2"
                max="50"
                className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                value={formData.playersMax}
                onChange={(e) => setFormData({...formData, playersMax: parseInt(e.target.value)})}
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
            
            {/* Display Selected */}
            <div className="bg-blue-50 p-3 rounded-xl flex items-center gap-3 border border-blue-100 mb-3">
                <MapPin className="text-blue-600 shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-900 truncate">{displayLocationName}</p>
                    <p className="text-xs text-blue-600 truncate">Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)}</p>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Search for a specific place..."
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={18} />}
            </div>

            {/* Suggestions List */}
            {suggestions.length > 0 && (
                <div className="mt-2 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-10">
                    {suggestions.map((place) => (
                        <button
                            key={place.place_id}
                            type="button" // Important to prevent form submission
                            onClick={() => handleSelectLocation(place)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-none"
                        >
                            <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{place.display_name.split(',')[0]}</p>
                                <p className="text-xs text-gray-500 truncate">{place.display_name}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
          </div>

        </form>
      </div>

      {/* Footer Action */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-8">
        <button 
            type="submit" 
            form="create-party-form"
            className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-full shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
            Host Party
        </button>
      </div>
    </div>
  );
};

export default CreatePartyView;