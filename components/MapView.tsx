import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Party, SportType } from '../types';
import { Users, Calendar, Clock } from 'lucide-react';

// Fix for default Leaflet marker icons in standard build environments
// In a real app we might import pngs, here we use divIcons for a custom look
// and to avoid 404s on marker images.

interface MapViewProps {
  parties: Party[];
  center: { lat: number; lng: number };
}

// Component to handle map center updates
const MapUpdater: React.FC<{ center: { lat: number; lng: number } }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15); // Zoom level 15
  }, [center, map]);
  return null;
};

// Custom Marker Icon Generator
const createCustomIcon = (sport: SportType) => {
  const colorMap: Record<string, string> = {
    Football: 'bg-green-500',
    Basketball: 'bg-orange-500',
    Badminton: 'bg-blue-500',
    Tennis: 'bg-yellow-500',
    Running: 'bg-red-500',
    Cycling: 'bg-purple-500',
    Yoga: 'bg-teal-500',
    All: 'bg-gray-500' // Default
  };

  const colorClass = colorMap[sport] || 'bg-blue-600';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="${colorClass} w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
               <circle cx="12" cy="12" r="10"></circle>
             </svg>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -32] // Point from which the popup should open relative to the iconAnchor
  });
};

const MapView: React.FC<MapViewProps> = ({ parties, center }) => {
  return (
    <div className="h-full w-full z-0 relative">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        className="h-full w-full outline-none"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapUpdater center={center} />

        {parties.map((party) => (
          <Marker
            key={party.id}
            position={[party.latitude, party.longitude]}
            icon={createCustomIcon(party.sport)}
          >
            <Popup className="custom-popup">
              <div className="p-1 min-w-[200px]">
                <h3 className="font-bold text-lg mb-1 text-gray-800">{party.title}</h3>
                <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">
                  {party.sport}
                </div>
                <p className="text-sm text-gray-600 mb-3">{party.description}</p>
                
                <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                   <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span>{party.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span>{party.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gray-400" />
                    <span className="font-medium">
                      {party.playersCurrent} / {party.playersMax} Players
                    </span>
                  </div>
                </div>

                <button className="mt-3 w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Join Party
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;