import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, MapPin, Loader2 } from 'lucide-react';
import { SportType } from '../types';
import { SPORTS_LIST, APP_CONFIG } from '../constants';

// Minimal types for the browser's speech recognition (not in TypeScript's DOM types).
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface SpeechRecognizer {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type SpeechRecognizerCtor = new () => SpeechRecognizer;
const getSpeechRecognition = (): SpeechRecognizerCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognizerCtor; webkitSpeechRecognition?: SpeechRecognizerCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

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
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  // Stop listening if the search bar goes away.
  useEffect(() => () => recognizerRef.current?.abort(), []);

  const showHint = (text: string) => {
    setVoiceHint(text);
    setTimeout(() => setVoiceHint((h) => (h === text ? null : h)), 3500);
  };

  // Voice search: say a place name and it's typed into the search box.
  const toggleVoiceSearch = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      showHint("Voice search isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    const rec = new Recognition();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setQuery(text.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showHint('Microphone blocked. Allow microphone access for this site in your browser settings.');
      } else if (e.error === 'no-speech') {
        showHint("Didn't hear anything. Tap the mic and try again.");
      } else if (e.error === 'network') {
        showHint('Voice search needs an internet connection.');
      } else if (e.error !== 'aborted') {
        showHint("Voice search didn't work. Please type instead.");
      }
    };
    rec.onend = () => { setIsListening(false); recognizerRef.current = null; };
    recognizerRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      showHint("Couldn't start voice search.");
    }
  };

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

  const dropdownOpen = isOpen && suggestions.length > 0;

  return (
    <div className="absolute top-0 left-0 right-0 md:right-auto md:w-[460px] z-[1000] flex flex-col pointer-events-none" ref={wrapperRef}>
      {/* Search Bar (Google Maps style floating pill) */}
      <div className="w-full px-3 pt-3 pointer-events-auto relative animate-in fade-in slide-in-from-top">
        <div className={`bg-white flex items-center h-12 pl-4 pr-1.5 gap-2 transition-[border-radius,box-shadow] duration-200 ${dropdownOpen ? 'rounded-t-3xl rounded-b-none shadow-elev-2' : 'rounded-full shadow-elev-1 hover:shadow-elev-2'}`}>

          {displayLogo ? (
            <div className="h-7 w-auto flex items-center pr-2">
                <img src={displayLogo} alt="App Logo" className="h-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center pr-1 select-none">
              <span className="font-medium tracking-tight text-[17px] text-gray-900">Sport<span className="text-red-600">Sphere</span></span>
            </div>
          )}
          <span className="w-px h-6 bg-gray-200" />

          <div className="flex-1 flex items-center relative min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
              placeholder={isListening ? 'Listening… say a place' : 'Search here'}
              className="w-full outline-none text-gray-900 text-[15px] placeholder-gray-500 bg-transparent"
            />
          </div>

          {isLoading && <Loader2 className="animate-spin text-gray-400" size={18} />}

          {!isLoading && query && !isListening && (
            <button onClick={clearSearch} aria-label="Clear search" className="ripple press w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100">
               <X size={20} />
            </button>
          )}

          {(!query || isListening) && (
            <button
              onClick={toggleVoiceSearch}
              aria-label={isListening ? 'Stop voice search' : 'Search by voice'}
              title={isListening ? 'Stop' : 'Search by voice'}
              className={`ripple press w-9 h-9 flex items-center justify-center rounded-full ${isListening ? 'bg-red-600 text-white animate-pulse' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Mic size={20} />
            </button>
          )}

          <button onClick={onAvatarClick} aria-label="Profile and settings" className="press w-9 h-9 rounded-full overflow-hidden ml-0.5 ring-2 ring-transparent hover:ring-gray-200">
            <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>

        {voiceHint && (
          <div className="mt-2 mx-auto w-fit max-w-full px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-medium shadow-elev-2 animate-in fade-in slide-in-from-top">
            {voiceHint}
          </div>
        )}

        {/* Autocomplete Dropdown */}
        {dropdownOpen && (
          <div className="absolute left-3 right-3 bg-white shadow-elev-2 rounded-b-3xl overflow-hidden flex flex-col pointer-events-auto max-h-72 overflow-y-auto border-t border-gray-100 animate-in fade-in">
            <div className="stagger">
            {suggestions.map((place) => (
              <button
                key={place.place_id}
                onClick={() => handleSelectLocation(place)}
                className="ripple w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 text-left"
              >
                <div className="w-9 h-9 shrink-0 bg-gray-100 rounded-full flex items-center justify-center">
                    <MapPin size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[15px] text-gray-900 truncate">
                    {place.structured_formatting.main_text}
                  </p>
                  <p className="text-[13px] text-gray-500 truncate">
                    {place.structured_formatting.secondary_text}
                  </p>
                </div>
              </button>
            ))}
            </div>
            <div className="px-4 py-2 text-right">
                <span className="text-[11px] text-gray-400">Powered by Google</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className={`w-full pl-3 mt-2.5 overflow-x-auto no-scrollbar pointer-events-auto pb-3 transition-all duration-200 ${isOpen ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <div className="flex gap-2 pr-3 min-w-max stagger">
          {SPORTS_LIST.map((sport) => {
            const isSelected = selectedSport === sport.type;
            return (
              <button
                key={sport.type}
                onClick={() => onSelectSport(sport.type)}
                aria-pressed={isSelected}
                className={`ripple press flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium shadow-elev-1 [&_svg]:w-4 [&_svg]:h-4 [&_img]:w-4 [&_img]:h-4
                  ${isSelected
                    ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                    : 'bg-white text-gray-800 hover:bg-gray-50'}`}
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
