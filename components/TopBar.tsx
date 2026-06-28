import React, { useState, useEffect, useRef } from 'react';
import { Menu, Mic, X, MapPin, Loader2 } from 'lucide-react';
import { SportType } from '../types';
import { SPORTS_LIST, APP_CONFIG } from '../constants';

interface TopBarProps {
  selectedSport: SportType;
  onSelectSport: (sport: SportType) => void;
  userAvatar: string;
  onAvatarClick: () => void;
  onLocationSelect: (lat: number, lng: number) => void;
  // Prop from centralized loader
  isLoaded: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ selectedSport, onSelectSport, userAvatar, onAvatarClick, onLocationSelect, isLoaded }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);

  const displayLogo = APP_CONFIG.headerLogoUrl || APP_CONFIG.logoUrl;

  // Initialize Autocomplete Service when maps script is loaded
  useEffect(() => {
    if (isLoaded && !autocompleteService.current && typeof google !== 'undefined') {
      autocompleteService.current = new google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  // Google Places Search
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim() || query.length < 3 || !autocompleteService.current) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const request: google.maps.places.AutocompletionRequest = {
            input: query,
        };

        autocompleteService.current.getPlacePredictions(request, (predictions: google.maps.places.AutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                setSuggestions(predictions);
                setIsOpen(true);
            } else {
                setSuggestions([]);
            }
            setIsLoading(false);
        });
      } catch (error) {
        console.error('Error fetching places:', error);
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [query, isLoaded]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (place: google.maps.places.AutocompletePrediction) => {
    // We need to fetch geometry for the selected place
    const mapDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(mapDiv);

    service.getDetails({
        placeId: place.place_id,
        fields: ['geometry', 'name']
    }, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result && result.geometry && result.geometry.location) {
            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            
            onLocationSelect(lat, lng);
            setQuery(result.name || place.structured_formatting.main_text);
            setIsOpen(false);
            setSuggestions([]);
        }
    });
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] flex flex-col pointer-events-none" ref={wrapperRef}>
      {/* Search Bar Container */}
      <div className="w-full px-4 pt-4 pointer-events-auto relative">
        <div className={`bg-zinc-900/90 backdrop-blur-md shadow-sm flex items-center p-3 gap-3 border border-zinc-800 transition-all duration-300 ease-in-out ${isOpen && suggestions.length > 0 ? 'rounded-t-3xl rounded-b-none' : 'rounded-full hover:shadow-md hover:bg-zinc-800'}`}>
          
          {displayLogo ? (
            <div className="h-8 w-auto flex items-center border-r border-zinc-700 pr-3 mr-1">
                <img src={displayLogo} alt="App Logo" className="h-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center border-r border-zinc-700 pr-3 mr-1">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight text-lg italic">SportSphere</span>
            </div>
          )}

          <div className="flex-1 flex items-center relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
              placeholder="Search places..."
              className="w-full outline-none text-white text-base placeholder-zinc-500 bg-transparent"
            />
          </div>
          
          {isLoading && <Loader2 className="animate-spin text-zinc-500" size={20} />}
          
          {!isLoading && query && (
            <button onClick={clearSearch} className="p-1 hover:bg-zinc-800 rounded-full active:scale-95 transition-all duration-200">
               <X className="text-zinc-400" size={20} />
            </button>
          )}

          {!query && <Mic className="text-zinc-500 cursor-pointer" size={20} />}
          
          <button onClick={onAvatarClick} className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-700 ml-1 active:scale-95 transition-all duration-200">
            <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 bg-zinc-900/95 backdrop-blur-md shadow-lg border-t border-zinc-800 rounded-b-3xl overflow-hidden flex flex-col pointer-events-auto max-h-60 overflow-y-auto transition-all duration-300 ease-in-out">
            {suggestions.map((place) => (
              <button
                key={place.place_id}
                onClick={() => handleSelectLocation(place)}
                className="flex items-start gap-3 p-4 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-none active:bg-zinc-700"
              >
                <div className="mt-0.5 bg-zinc-800 p-2 rounded-full">
                    <MapPin size={16} className="text-zinc-400" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">
                    {place.structured_formatting.main_text}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {place.structured_formatting.secondary_text}
                  </p>
                </div>
              </button>
            ))}
            <div className="p-2 bg-zinc-900 text-right">
                <span className="text-[10px] text-zinc-500">Powered by Google</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips Container */}
      <div className={`w-full pl-4 mt-3 overflow-x-auto no-scrollbar pointer-events-auto pb-2 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <div className="flex gap-2 pr-4 min-w-max">
          {SPORTS_LIST.map((sport) => {
            const isSelected = selectedSport === sport.type;
            return (
              <button
                key={sport.type}
                onClick={() => onSelectSport(sport.type)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-in-out shadow-sm border
                  ${isSelected 
                    ? 'bg-red-600 text-white border-red-500 scale-105 shadow-md shadow-red-900/50' 
                    : 'bg-zinc-900/80 backdrop-blur-sm text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:scale-105 hover:text-white'}
                  active:scale-95
                `}
              >
                {sport.icon}
                {sport.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TopBar;