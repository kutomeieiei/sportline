import React, { useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { GoogleMap, MarkerF, InfoWindowF, OverlayViewF, OverlayView } from '@react-google-maps/api';
import { Party, SportType, DiscoveryResult, Venue, SportConfig } from '../types';
import { Users, Calendar, Clock, Loader2, AlertTriangle, MapPin, CheckCircle, Navigation, Car, Trash2, Trophy, Footprints, Bike, PersonStanding, Dribbble, Send } from 'lucide-react';
import { formatDistance } from '../utils/geospatial';
import { db } from '../firebase';

interface MapViewProps {
  parties: Party[];
  venues: Venue[];
  discoveredUsers?: DiscoveryResult[];
  center: { lat: number; lng: number };
  currentUser: string;
  currentUserUid: string;
  onJoinParty: (partyId: string) => void;
  onShareVenue: (venue: Venue) => void;
  onAddFriend: (username: string) => void;
  // Props from centralized loader in App.tsx
  isLoaded: boolean;
  loadError?: Error;
  isLive?: boolean;
  userLocation?: google.maps.LatLngLiteral | null;
  sportConfigs?: SportConfig[];
}

const getSportIcon = (sport: SportType, className: string) => {
    switch (sport) {
        case 'Football': return <Footprints className={className} />;
        case 'Basketball': return <Dribbble className={className} />;
        case 'Badminton': return <Trophy className={className} />;
        case 'Tennis': return <Trophy className={className} />;
        case 'Running': return <Footprints className={className} />;
        case 'Cycling': return <Bike className={className} />;
        case 'Yoga': return <PersonStanding className={className} />;
        default: return <Trophy className={className} />;
    }
};

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Map styles to remove default POIs for a cleaner look
const mapOptions: google.maps.MapOptions = {
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
const getMarkerIcon = (sport: SportType, sportConfigs?: SportConfig[]): google.maps.Icon => {
  const config = sportConfigs?.find(c => c.id === sport);
  
  if (config && config.markerUrl) {
    let finalUrl = config.markerUrl;
    // Handle Google Drive links
    if (finalUrl.includes('drive.google.com/file/d/')) {
        const match = finalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            finalUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }

    return {
      url: finalUrl,
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 40)
    };
  }

  // Fallback to old SVG if no custom marker is set
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
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 40)
  };
};

const getUserMarkerIcon = (): google.maps.Icon => {
  // SVG for a user marker (purple circle)
  const svg = `
    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="14" fill="#8b5cf6" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="15" r="4" fill="white"/>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(30, 30),
    anchor: new google.maps.Point(15, 15)
  };
};

const getMyMarkerIcon = (): google.maps.Icon => {
  // SVG for "Me" marker (red pulsing circle)
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="12" fill="#ef4444" stroke="white" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="white"/>
      <circle cx="20" cy="20" r="12" fill="#ef4444" opacity="0.3">
        <animate attributeName="r" from="12" to="19" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20)
  };
};

const getVenueMarkerIcon = (): google.maps.Icon => {
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C11.16 0 4 7.16 4 16c0 9.5 13.5 22.5 15.2 24.1.4.4 1.1.4 1.6 0C22.5 38.5 36 25.5 36 16c0-8.84-7.16-16-16-16z" fill="#16a34a" stroke="white" stroke-width="1.5"/>
      <path d="M14 15h12v2H14zM14 19h12v2H14zM14 23h12v2H14z" fill="white"/>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 40)
  };
};

const MapView: React.FC<MapViewProps> = ({ parties, venues, discoveredUsers = [], center, currentUser, currentUserUid, onJoinParty, onShareVenue, onAddFriend, isLoaded, loadError, isLive, userLocation, sportConfigs }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [selectedUser, setSelectedUser] = useState<DiscoveryResult | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [partyMembers, setPartyMembers] = useState<User[]>([]);

  const handleDeleteParty = async (partyId: string) => {
    if (!db) return;
    if (!window.confirm("Are you sure you want to delete this party? This action cannot be undone.")) return;

    try {
        await db.collection('parties').doc(partyId).delete();
        setSelectedParty(null);
    } catch (error) {
        console.error("Error deleting party:", error);
        alert("Failed to delete party. You may not have permission.");
    }
  };

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
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

  useEffect(() => {
    if (selectedParty && db) {
      const fetchMembers = async () => {
        if (selectedParty.members.length === 0) {
          setPartyMembers([]);
          return;
        }

        try {
          const memberPromises = selectedParty.members.map(username => 
            db.collection('users').where('username', '==', username).limit(1).get()
          );
          const memberSnapshots = await Promise.all(memberPromises);
          const membersData = memberSnapshots.map(snapshot => {
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              return { uid: doc.id, ...doc.data() } as User;
            }
            return null;
          }).filter((u): u is User => u !== null);

          setPartyMembers(membersData);
        } catch (error) {
          console.error("Error fetching party members:", error);
          setPartyMembers([]);
        }
      };

      fetchMembers();
    } else {
      setPartyMembers([]);
    }
  }, [selectedParty]);

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
    const isAlreadyInAParty = parties.some(p => p.members.includes(currentUser));
    const isJoined = party.members.includes(currentUser);
    const isFull = party.playersCurrent >= party.playersMax;

    if (isAlreadyInAParty && !isJoined) {
        return { text: "In another party", disabled: true, className: "bg-gray-300 text-gray-500 cursor-not-allowed" };
    }

    if (isJoined) {
        return { text: "Joined", disabled: true, className: "bg-green-600 text-white cursor-default" };
    }
    if (isFull) {
        return { text: "Full", disabled: true, className: "bg-gray-300 text-gray-500 cursor-not-allowed" };
    }
    return { text: "Join Party", disabled: false, className: "bg-blue-600 text-white hover:bg-blue-700" };
  };

  const handleNavigate = (item: Party | Venue) => {
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    let destinationParam = "";
    
    if ('placeId' in item && item.placeId) {
        destinationParam = `&destination_place_id=${item.placeId}&destination=${encodeURIComponent(item.venueName || item.name || "Destination")}`;
    } else {
        destinationParam = `&destination=${item.latitude},${item.longitude}`;
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
      onClick={() => {
        setSelectedParty(null);
        setSelectedUser(null);
      }}
    >
      {isLive && (
        <MarkerF
          position={userLocation || center}
          icon={getMyMarkerIcon()}
          zIndex={1000}
          title="You are here (Live)"
        />
      )}

      {parties.map((party) => {
        const config = sportConfigs?.find(c => c.id === party.sport);
        let customUrl = config?.markerUrl;
        
        if (customUrl) {
            if (customUrl.includes('drive.google.com/file/d/')) {
                const match = customUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    customUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
                }
            }
            return (
              <OverlayViewF
                key={party.id}
                position={{ lat: party.latitude, lng: party.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedParty(party);
                    setSelectedUser(null);
                  }}
                  className="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform z-10"
                  style={{ width: '48px', height: '48px' }}
                >
                  <img 
                    src={customUrl} 
                    alt={party.sport}
                    className="w-full h-full object-contain drop-shadow-md"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </OverlayViewF>
            );
        }

        return (
          <MarkerF
            key={party.id}
            position={{ lat: party.latitude, lng: party.longitude }}
            icon={getMarkerIcon(party.sport, sportConfigs)}
            onClick={() => {
              setSelectedParty(party);
              setSelectedUser(null);
            }}
          />
        );
      })}

        {/* Discovered User Markers */}
        {discoveredUsers.map((result) => (
          <OverlayViewF
            key={result.uid}
            position={{ lat: result.location.l[0], lng: result.location.l[1] }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUser(result);
                setSelectedParty(null);
              }}
              className="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform z-10"
              style={{ width: '40px', height: '40px' }}
            >
              <svg className="absolute inset-0 w-full h-full drop-shadow-md" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0C11.16 0 4 7.16 4 16c0 9.5 13.5 22.5 15.2 24.1.4.4 1.1.4 1.6 0C22.5 38.5 36 25.5 36 16c0-8.84-7.16-16-16-16z" fill="#3b82f6" stroke="white" strokeWidth="1.5"/>
              </svg>
              <img 
                src={result.user?.profile_img_url || 'https://via.placeholder.com/150'} 
                alt={result.user?.display_name || 'User'}
                className="absolute w-6 h-6 rounded-full object-cover border border-white"
                style={{ top: '4px' }}
                referrerPolicy="no-referrer"
              />
            </div>
          </OverlayViewF>
        ))}

        {/* Venue Markers */}
        {venues.map(venue => (
          <MarkerF
            key={venue.id}
            position={{ lat: venue.latitude, lng: venue.longitude }}
            icon={getVenueMarkerIcon()}
            onClick={() => {
              setSelectedParty(null);
              setSelectedUser(null);
              setSelectedVenue(venue);
            }}
          />
        ))}

      {selectedUser && (
        <InfoWindowF
          position={{ lat: selectedUser.location.l[0], lng: selectedUser.location.l[1] }}
          onCloseClick={() => setSelectedUser(null)}
          options={{
             pixelOffset: new google.maps.Size(0, -30),
             disableAutoPan: false
          }}
        >
          <div className="p-3 min-w-[220px] max-w-[260px] flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img 
                src={selectedUser.user?.profile_img_url || selectedUser.user?.avatarUrl || 'https://via.placeholder.com/150'} 
                alt="Profile" 
                className="w-12 h-12 rounded-full object-cover border border-gray-200"
                referrerPolicy="no-referrer"
              />
              <div>
                <h3 className="font-bold text-base text-gray-900 leading-tight">
                    {selectedUser.user?.display_name || selectedUser.user?.displayName || 'Unknown User'}
                </h3>
                <p className="text-xs text-gray-500">
                    {selectedUser.precise_distance.toFixed(0)}m away
                </p>
              </div>
            </div>

            {(selectedUser.user?.gender || selectedUser.user?.bio) && (
              <div className="bg-gray-50 p-2 rounded-lg text-sm">
                {selectedUser.user?.gender && (
                  <p className="text-gray-700 mb-1"><span className="font-semibold">Gender:</span> {selectedUser.user.gender}</p>
                )}
                {selectedUser.user?.bio && (
                  <p className="text-gray-600 italic text-xs line-clamp-3">"{selectedUser.user.bio}"</p>
                )}
              </div>
            )}

            {(() => {
                const broadcastedSport = selectedUser.location.sport;
                const sports = selectedUser.user?.preferred_sports || (selectedUser.user as any)?.preferredSports || [];
                
                if (broadcastedSport && broadcastedSport !== 'All') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">Looking for:</span>
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                                {broadcastedSport}
                            </span>
                        </div>
                    );
                }

                if (sports.length > 0) {
                    return (
                        <div className="flex flex-wrap gap-1">
                            {sports.map((s: string) => (
                                <span key={s} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                                    {s}
                                </span>
                            ))}
                        </div>
                    );
                }
                return null;
            })()}
            
            {selectedUser.user?.username && selectedUser.user.username !== currentUser && (
                <button
                    onClick={() => {
                        onAddFriend(selectedUser.user!.username!);
                        setSelectedUser(null);
                    }}
                    className="w-full mt-1 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                    Add Friend
                </button>
            )}
          </div>
        </InfoWindowF>
      )}

        {/* Venue InfoWindow */}
        {selectedVenue && (
          <InfoWindowF
            position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
            onCloseClick={() => setSelectedVenue(null)}
            options={{ pixelOffset: new google.maps.Size(0, -40) }}
          >
            <div className="p-0 font-sans max-w-[300px]">
              <img src={selectedVenue.imageUrl} alt={selectedVenue.name} className="w-full h-32 object-cover rounded-t-lg" />
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-gray-900 mb-1 pr-2">{selectedVenue.name}</h3>
                  {selectedVenue.distance !== undefined && (
                      <div className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Straight-line distance">
                          <Navigation size={10} />
                          {formatDistance(selectedVenue.distance)}
                      </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-3">{selectedVenue.description}</p>
                <div className="space-y-2">
                  {selectedVenue.courts.map((court, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                      <div className="p-2 bg-green-100 rounded-full">
                        {getSportIcon(court.sport, 'w-5 h-5 text-green-700')}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{court.name}</p>
                        <p className="text-sm text-gray-500">{court.sport}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button 
                    onClick={() => onShareVenue(selectedVenue)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Send size={16} />
                    Share Venue
                  </button>
                  <button 
                    onClick={() => handleNavigate(selectedVenue)} 
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Navigation size={16} />
                    Navigate
                  </button>
                </div>
              </div>
            </div>
          </InfoWindowF>
        )}

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
                 
                 <div className="flex items-center gap-1">
                     {/* Show Distance */}
                     {selectedParty.distance !== undefined && (
                         <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Straight-line distance">
                             <Navigation size={10} />
                             {formatDistance(selectedParty.distance)}
                         </div>
                     )}
                     
                     {/* Show Travel Time */}
                     {selectedParty.travelTime && (
                        <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Driving time">
                            <Car size={10} />
                            {selectedParty.travelTime}
                        </div>
                     )}
                 </div>
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

            {partyMembers.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">In Party</h4>
                  <div className="flex items-center space-x-2">
                      {partyMembers.map(member => (
                          <img 
                              key={member.uid}
                              src={member.profile_img_url || member.avatarUrl || 'https://i.pravatar.cc/150'}
                              alt={member.displayName}
                              title={member.displayName}
                              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                      ))}
                  </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
                <button 
                    onClick={() => handleNavigate(selectedParty)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    title="Navigate"
                >
                    <Navigation size={16} />
                </button>

                {selectedParty.hostUid === currentUserUid && (
                    <button 
                        onClick={() => handleDeleteParty(selectedParty.id)}
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        title="Delete Party"
                    >
                        <Trash2 size={16} />
                    </button>
                )}

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

const MemoizedMapView = React.memo(MapView);
export default MemoizedMapView;
