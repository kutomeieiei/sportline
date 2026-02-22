import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { Party, User } from '../types';
import { useState } from 'react';

interface MapProps {
  parties: Party[];
  users: User[];
  center: { lat: number; lng: number };
  onCameraIdle: (center: { lat: number; lng: number }, zoom: number) => void;
}

export default function Map({ parties, users, center, onCameraIdle }: MapProps) {
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap
        defaultCenter={center}
        defaultZoom={14}
        mapId="a3b4c5d6e7f8g9h0"
        onCameraChanged={(ev) => onCameraIdle(ev.detail.center, ev.detail.zoom)}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
      >
        {parties.map((party) => (
          <AdvancedMarker key={party.id} position={{ lat: party.latitude, lng: party.longitude }} onClick={() => setSelectedParty(party)}>
            <Pin />
          </AdvancedMarker>
        ))}
        {users.map((user) => (
          <AdvancedMarker key={user.uid} position={user.static_coords!} onClick={() => setSelectedUser(user)}>
            <Pin background={'#FBBC04'} glyphColor={'#000'} borderColor={'#000'} />
          </AdvancedMarker>
        ))}

        {selectedParty && (
          <InfoWindow position={{ lat: selectedParty.latitude, lng: selectedParty.longitude }} onCloseClick={() => setSelectedParty(null)}>
            <div>
              <h3>{selectedParty.title}</h3>
              <p>{selectedParty.description}</p>
            </div>
          </InfoWindow>
        )}

        {selectedUser && (
          <InfoWindow position={selectedUser.static_coords!} onCloseClick={() => setSelectedUser(null)}>
            <div>
              <h3>{selectedUser.displayName}</h3>
              <p>{selectedUser.bio}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </APIProvider>
  );
}
