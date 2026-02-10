import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Party, SportType } from '../types';
import { Users, Calendar, Clock, Loader2, AlertTriangle, MapPin, ExternalLink } from 'lucide-react';

// Declare google global to avoid TS namespace errors
declare var google: any;

interface MapViewProps {
  parties: Party[];
  center: { lat: number; lng: number };
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
  // ViewBox 0 0 40 40
  // Pin tip at bottom center (20, 40)
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C11.16 0 4 7.16 4 16c0 9.5 13.5 22.5 15.2 24.1.4.4 1.1.4 1.6 0C22.5 38.5 36 25.5 36 16c0-8.84-7.16-16-16-16z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="20" cy="16" r="6" fill="white"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 } as any,
    anchor: { x: 20, y: 40 } as any // Anchor at the bottom tip
  };
};

const MapInner: React.FC<MapViewProps & { apiKey: string }> = ({ parties, center, apiKey }) => {
  const [map, setMap] = useState<any | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const onLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Handle center updates from parent (e.g., search result)
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
            Double check your API key in the <code>.env</code> file.
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
             pixelOffset: new google.maps.Size(0, -42), // Adjusted offset for taller pin (40px height + margin)
             disableAutoPan: false
          }}
        >
          <div className="p-1 min-w-[200px] max-w-[240px]">
            <h3 className="font-bold text-lg mb-1 text-gray-800">{selectedParty.title}</h3>
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">
              {selectedParty.sport}
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{selectedParty.description}</p>
            
            <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span>{selectedParty.date}</span>
                </div>
                <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                <span>{selectedParty.time}</span>
                </div>
                <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <span className="font-medium">
                    {selectedParty.playersCurrent} / {selectedParty.playersMax} Players
                </span>
                </div>
            </div>

            <button className="mt-3 w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Join Party
            </button>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
};

const MapView: React.FC<MapViewProps> = (props) => {
  // Safely access env
  const rawApiKey = ((import.meta as any).env && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY);
  
  // Clean up key: remove whitespace and quotes if user accidentally added them
  const apiKey = rawApiKey ? rawApiKey.replace(/['"]/g, '').trim() : '';
  const isDefault = apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  if (!apiKey || isDefault) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
               <MapPin size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Setup Google Maps</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
                To use this app, you need to generate a free API Key from Google.
            </p>
            
            <a 
                href="https://developers.google.com/maps/documentation/javascript/get-api-key" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 text-sm font-semibold hover:underline flex items-center gap-1 my-1"
            >
                Get your API Key here <ExternalLink size={14} />
            </a>

            <div className="w-full bg-gray-50 p-4 rounded-xl text-left border border-gray-100 mt-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Instructions</p>
                <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Get a key from the link above</li>
                    <li>Open the <code className="bg-gray-200 px-1 rounded text-gray-800">.env</code> file in this project</li>
                    <li>Paste your key like this:</li>
                </ol>
                <div className="mt-3 bg-gray-800 p-3 rounded-lg overflow-x-auto">
                    <code className="text-xs text-green-400 font-mono whitespace-nowrap">VITE_GOOGLE_MAPS_API_KEY=AIzaSy...</code>
                </div>
            </div>

            <button 
                onClick={() => window.location.reload()}
                className="mt-2 w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
            >
                I've added the key, Reload App
            </button>
        </div>
      </div>
    );
  }

  return <MapInner {...props} apiKey={apiKey} />;
};

export default React.memo(MapView);