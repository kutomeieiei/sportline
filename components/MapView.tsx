import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Party, SportType } from '../types';
import { Users, Calendar, Clock, Loader2, AlertTriangle, MapPin, ExternalLink, CheckCircle, Navigation, Car } from 'lucide-react';
import { formatDistance } from '../utils/geospatial';

// Declare google global to avoid TS namespace errors
declare var google: any;

interface MapViewProps {
  parties: Party[];
  center: { lat: number; lng: number };
  currentUser: string;
  onJoinParty: (partyId: string) => void;
  // Props from centralized loader in App.tsx
  isLoaded: boolean;
  loadError?: Error;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Map styles to remove default POIs for a cleaner look
const mapOptions: any = {
  disableDefaultUI: true, // Hides standard Google Maps controls
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false, // Prevents clicking on generic Google Maps places
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
};

// Helper to generate SVG Data URI for markers based on sport color
const getMarkerIcon = (sport: SportType) => {
  const colorMap: Record<string, string> = {
    Football: '#22c55e', // green-500
    Basketball: '#f97316', // orange-500
    Badminton: '#3b82f6', // blue-500
    Tennis: '#eab308', // yellow-500
    Running: '#ef4444', // red-500
    Cycling: '#a855f7', // purple-500
    Yoga: '#14b8a6', // teal-500
    All: '#6b7280' // gray-500
  };

  const color = colorMap[sport] || '#2563eb';

  // SVG string for a pin (teardrop) shape with a hole in the center
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C11.16 0 4 7.16 4 16c0 9.5 13.5 22.5 15.2 24.1.4.4 1.1.4 1.6 0C22.5 38.5 36 25.5 36 16c0-8.84-7.16-16-16-16z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="20" cy="16" r="6" fill="white"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 } as any,
    anchor: { x: 20, y: 40 } as any
  };
};

const MapView: React.FC<MapViewProps> = ({ parties, center, currentUser, onJoinParty, isLoaded, loadError }) => {
  const [map, setMap] = useState<any | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  const onLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (map) {
      map.panTo(center);
    }
  }, [center, map]);

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 p-4">
        <div className="flex flex-col items-center gap-2 text-center max-w-md bg-white p-6 rounded-xl shadow-lg">
          <AlertTriangle className="text-red-500" size={32} />
          <p className="text-gray-800 font-bold text-lg">Map Failed to Load</p>
          <div className="bg-red-50 p-3 rounded-lg w-full text-left border border-red-100">
            <p className="text-xs text-red-800 font-mono break-all">
               {loadError.message}
            </p>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Make sure <strong>Maps JavaScript API</strong> is enabled in Google Cloud Console.
          </p>
          <button 
             onClick={() => window.location.reload()}
             className="mt-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium"
          >
             Reload App
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-gray-500 font-medium">Loading Map...</p>
        </div>
      </div>
    );
  }

  const getButtonState = (party: Party) => {
    const isJoined = party.members.includes(currentUser);
    const isFull = party.playersCurrent >= party.playersMax;

    if (isJoined) {
        return { text: "Joined", disabled: true, className: "bg-green-600 text-white cursor-default" };
    }
    if (isFull) {
        return { text: "Full", disabled: true, className: "bg-gray-300 text-gray-500 cursor-not-allowed" };
    }
    return { text: "Join Party", disabled: false, className: "bg-blue-600 text-white hover:bg-blue-700" };
  };

  const handleNavigate = (party: Party) => {
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    let destinationParam = "";
    
    if (party.placeId) {
        destinationParam = `&destination_place_id=${party.placeId}&destination=${encodeURIComponent(party.venueName || "Destination")}`;
    } else {
        destinationParam = `&destination=${party.latitude},${party.longitude}`;
    }

    window.open(`${baseUrl}${destinationParam}&travelmode=driving`, '_blank');
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={14}
      options={mapOptions}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={() => setSelectedParty(null)}
    >
      {parties.map((party) => (
        <MarkerF
          key={party.id}
          position={{ lat: party.latitude, lng: party.longitude }}
          icon={getMarkerIcon(party.sport)}
          onClick={() => setSelectedParty(party)}
        />
      ))}

      {selectedParty && (
        <InfoWindowF
          position={{ lat: selectedParty.latitude, lng: selectedParty.longitude }}
          onCloseClick={() => setSelectedParty(null)}
          options={{
             pixelOffset: new google.maps.Size(0, -42),
             disableAutoPan: false
          }}
        >
          <div className="p-1 min-w-[200px] max-w-[240px]">
            <h3 className="font-bold text-lg mb-0.5 text-gray-800 leading-tight">{selectedParty.title}</h3>
            {selectedParty.venueName && (
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin size={10} /> {selectedParty.venueName}
                </p>
            )}
            
            <div className="flex items-center justify-between mb-2 mt-2">
                 <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    {selectedParty.sport}
                 </div>
                 {/* Display Travel Time if available, else standard distance */}
                 {selectedParty.travelTime ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Car size={10} />
                        {selectedParty.travelTime}
                    </div>
                 ) : selectedParty.distance !== undefined ? (
                     <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                         <Navigation size={10} />
                         {formatDistance(selectedParty.distance)}
                     </div>
                 ) : null}
            </div>

            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{selectedParty.description}</p>
            
            <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span>{selectedParty.date}</span>
                </div>
                <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                <span>{selectedParty.startTime} - {selectedParty.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <span className="font-medium">
                    {selectedParty.playersCurrent} / {selectedParty.playersMax} Players
                </span>
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button 
                    onClick={() => handleNavigate(selectedParty)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    title="Navigate"
                >
                    <Navigation size={16} />
                </button>
                {(() => {
                    const btn = getButtonState(selectedParty);
                    return (
                        <button 
                            onClick={() => onJoinParty(selectedParty.id)}
                            disabled={btn.disabled}
                            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${btn.className}`}
                        >
                            {btn.text === "Joined" && <CheckCircle size={14} />}
                            {btn.text}
                        </button>
                    );
                })()}
            </div>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
};

export default React.memo(MapView);