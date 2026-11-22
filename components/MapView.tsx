import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LIGHT_MAP_STYLE } from '../utils/mapStyle';
import { User } from '../types';
import { GoogleMap, MarkerF, OverlayViewF, OverlayView } from '@react-google-maps/api';
import { Party, DiscoveryResult, Venue, SportConfig } from '../types';
import { Users, Calendar, Clock, Loader2, AlertTriangle, MapPin, CheckCircle, Navigation, Car, Trash2, Send, X, Plus, MessageCircle, LogOut, UsersRound } from 'lucide-react';
import { sportIconFor } from '../constants';
import VenuePhoto from './VenuePhoto';
import { formatDistance } from '../utils/geospatial';
import { db } from '../firebase';
import { useProfiles } from '../hooks/useProfiles';
import { fallbackAvatar } from '../utils/image';
import { isPartyOver, partyWhen, sportEmoji } from '../utils/party';
import { isTouchDevice, useIsPhone } from '../utils/device';
import MapCard from './MapCard';

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
  /** Open someone's profile page. */
  onOpenProfile?: (target: { uid: string; preview?: User; distanceM?: number; lookingFor?: string }) => void;
  // Props from centralized loader in App.tsx
  isLoaded: boolean;
  loadError?: Error;
  isLive?: boolean;
  userLocation?: google.maps.LatLngLiteral | null;
  sportConfigs?: SportConfig[];
  /** Open this party's details (e.g. after tapping a note in Chat). */
  focusPartyId?: string | null;
  onFocusHandled?: () => void;
  /** Start a new game at a spot the person clicked/tapped on the map. */
  onCreateAt?: (location: { lat: number; lng: number }, placeName?: string) => void;
  /** Start a group chat about a venue. */
  onStartGroupAt?: (venue: Venue) => void;
  /** Leave a game I joined, and open a game's group chat. */
  onLeaveParty?: (partyId: string) => void;
  onOpenPartyChat?: (party: Party) => void;
  /** The "Share my location" card, shown at my position. */
  shareCard?: { position: google.maps.LatLngLiteral; content: React.ReactNode; onClose: () => void } | null;
  /** False while another screen (Chat, Settings) covers the map: close its cards. */
  active?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

// How you move the map:
// - Phone/tablet (like Google Maps): a quick tap selects / plans a game, press
//   and drag with one finger to move, two fingers to zoom and move.
// - Computer: left click plans a game, drag with the RIGHT mouse button to move,
//   scroll wheel zooms.
const TOUCH = isTouchDevice();

// Map styles to remove default POIs for a cleaner look
const mapOptions: google.maps.MapOptions = {
  // 'greedy': one finger moves the map (a drag never counts as a tap).
  gestureHandling: 'greedy',
  // Left-drag is turned off on computers so a left click always means "plan a game here".
  draggable: TOUCH ? undefined : false,
  disableDefaultUI: true, // Hides standard Google Maps controls
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false, // Prevents clicking on generic Google Maps places
  styles: LIGHT_MAP_STYLE
};

// Venue pins have a fixed size on the ground, like the buildings on the map:
// 36px wide at zoom 15, twice as big for each step you zoom in, half for each
// step out. Kept between 12px (still visible) and 96px (doesn't hide the map).
const VENUE_PIN_REF_ZOOM = 15;
const venuePinWidth = (zoom: number) =>
  Math.round(Math.min(96, Math.max(12, 36 * 2 ** (zoom - VENUE_PIN_REF_ZOOM))));

// Admin-set sport icons can be Google Drive links; turn them into direct image links.
const directImageUrl = (url?: string) => {
  if (!url) return undefined;
  const match = url.includes('drive.google.com/file/d/') ? url.match(/\/d\/([a-zA-Z0-9_-]+)/) : null;
  return match?.[1] ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
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

const MapView: React.FC<MapViewProps> = ({ parties, venues, discoveredUsers = [], center, currentUser, currentUserUid, onJoinParty, onShareVenue, onAddFriend, isLoaded, loadError, isLive, userLocation, sportConfigs, focusPartyId, onFocusHandled, onCreateAt, onOpenProfile, onStartGroupAt, onLeaveParty, onOpenPartyChat, shareCard, active = true }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [selectedUser, setSelectedUser] = useState<DiscoveryResult | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [partyMembers, setPartyMembers] = useState<User[]>([]);
  // Where the person clicked/tapped to plan a new game.
  const [droppedPin, setDroppedPin] = useState<google.maps.LatLngLiteral | null>(null);
  // Venue under the mouse: shows a small photo + name card.
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);
  // Google also reports clicks on our bubbles/cards as map clicks; remember
  // when one of ours was pressed so that click doesn't drop a new pin.
  const overlayPressedAt = useRef(0);
  const markOverlayPress = () => { overlayPressedAt.current = Date.now(); };
  // Where the left button went down, so a drag isn't treated as a click.
  const leftDownAt = useRef<{ x: number; y: number } | null>(null);

  // Computer: drag with the right mouse button to move the map, wheel to zoom.
  useEffect(() => {
    if (!map || TOUCH) return;
    const el = map.getDiv();
    let last: { x: number; y: number } | null = null;
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) leftDownAt.current = { x: e.clientX, y: e.clientY };
      if (e.button !== 2) return;
      last = { x: e.clientX, y: e.clientY };
      el.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!last) return;
      const projection = map.getProjection();
      const c = map.getCenter();
      if (!projection || !c) return;
      // Move the centre by the mouse distance, converted from screen pixels to map units.
      const scale = 2 ** (map.getZoom() || 0);
      const point = projection.fromLatLngToPoint(c);
      if (!point) return;
      const next = projection.fromPointToLatLng(new google.maps.Point(
        point.x + (last.x - e.clientX) / scale,
        point.y + (last.y - e.clientY) / scale,
      ));
      if (next) map.setCenter(next);
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      if (!last) return;
      last = null;
      el.style.cursor = '';
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();

    // Mouse wheel zoom. Google turns its own wheel zoom off when left-drag is
    // off, so do it here: one step per wheel notch, keeping the spot under the
    // mouse in place (like Google Maps).
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 160 || e.deltaY === 0) return;
      lastWheel = now;
      const zoomNow = map.getZoom() ?? 14;
      const zoomNext = Math.max(3, Math.min(21, zoomNow + (e.deltaY < 0 ? 1 : -1)));
      if (zoomNext === zoomNow) return;
      const projection = map.getProjection();
      const c = map.getCenter();
      const point = c && projection?.fromLatLngToPoint(c);
      if (!projection || !point) { map.setZoom(zoomNext); return; }
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left - rect.width / 2;
      const offY = e.clientY - rect.top - rect.height / 2;
      // Map spot under the mouse, then the centre that keeps it under the mouse after zooming.
      const under = new google.maps.Point(point.x + offX / 2 ** zoomNow, point.y + offY / 2 ** zoomNow);
      const centre = projection.fromPointToLatLng(new google.maps.Point(under.x - offX / 2 ** zoomNext, under.y - offY / 2 ** zoomNext));
      if (centre) map.moveCamera({ center: centre, zoom: zoomNext });
      else map.setZoom(zoomNext);
    };

    el.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('contextmenu', noMenu);
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      el.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('contextmenu', noMenu);
      el.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [map]);

  // Only games that haven't finished yet are shown.
  const upcomingParties = parties.filter((p) => !isPartyOver(p));
  const hostProfiles = useProfiles(upcomingParties.map((p) => p.hostUid));

  // Phones show details as a sheet at the bottom of the screen (map popups get too narrow).
  const isPhone = useIsPhone();

  // Share card: PC - put my position low so the popup fits above it;
  // phone - put it high so it isn't hidden behind the bottom sheet.
  const shareOpen = !!shareCard;
  const sharePos = shareCard?.position;
  useEffect(() => {
    if (!map || !shareOpen || !sharePos) return;
    map.panTo(sharePos);
    const lift = Math.round(map.getDiv().clientHeight * 0.25);
    const t = setTimeout(() => map.panBy(0, isPhone ? lift : -lift), 80);
    return () => clearTimeout(t);
  }, [map, shareOpen, sharePos, isPhone]);

  // Phone: move what you tapped into the top part of the map, above the sheet.
  const sheetLat = !isPhone ? undefined : selectedVenue?.latitude ?? selectedParty?.latitude ?? selectedUser?.location.l[0];
  const sheetLng = !isPhone ? undefined : selectedVenue?.longitude ?? selectedParty?.longitude ?? selectedUser?.location.l[1];
  // How tall the tapped marker is: game bubbles are tall, pins are short.
  const sheetMarkerHeight = selectedParty ? 115 : 60;
  useEffect(() => {
    if (!map || sheetLat === undefined || sheetLng === undefined) return;
    map.panTo({ lat: sheetLat, lng: sheetLng });
    // Put the point just under the search bar + sport chips (about 120px), leaving
    // room for the marker above it, so the sheet below doesn't cover it.
    const target = 120 + sheetMarkerHeight;
    const shift = Math.max(0, Math.round(map.getDiv().clientHeight / 2 - target));
    const t = setTimeout(() => map.panBy(0, shift), 80);
    return () => clearTimeout(t);
  }, [map, sheetLat, sheetLng, sheetMarkerHeight]);

  // Another screen covers the map: close its cards (sheets would otherwise float on top).
  useEffect(() => {
    if (active) return;
    setSelectedParty(null);
    setSelectedUser(null);
    setSelectedVenue(null);
    setDroppedPin(null);
  }, [active]);

  // Keep an open party's details live (players, members) after joining/leaving.
  useEffect(() => {
    if (!selectedParty) return;
    const fresh = parties.find((p) => p.id === selectedParty.id);
    if (!fresh) { setSelectedParty(null); return; }
    const sig = (p: Party) => `${p.playersCurrent}|${p.playersMax}|${(p.members || []).join(',')}|${p.title}|${p.date}|${p.startTime}`;
    if (sig(fresh) !== sig(selectedParty)) setSelectedParty(fresh);
  }, [parties, selectedParty]);

  // Open a party asked for from elsewhere (tapping a note in Chat).
  useEffect(() => {
    if (!focusPartyId || !map) return;
    const party = parties.find((p) => p.id === focusPartyId);
    if (!party) return;
    setSelectedParty(party);
    setSelectedUser(null);
    setSelectedVenue(null);
    map.panTo({ lat: party.latitude, lng: party.longitude });
    if ((map.getZoom() || 0) < 15) map.setZoom(15);
    onFocusHandled?.();
  }, [focusPartyId, map, parties, onFocusHandled]);

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

  // Current zoom level (venue pins grow and shrink with it).
  const [zoom, setZoom] = useState(14);
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    setZoom(mapInstance.getZoom() ?? 14);
    mapInstance.addListener('zoom_changed', () => setZoom(mapInstance.getZoom() ?? 14));
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
          <AlertTriangle className="text-red-600" size={32} />
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
             className="mt-2 px-4 py-2 bg-gray-900 text-gray-900 rounded-lg text-sm font-medium"
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
            <Loader2 className="animate-spin text-red-700" size={32} />
            <p className="text-gray-500 font-medium">Loading Map...</p>
        </div>
      </div>
    );
  }

  const getButtonState = (party: Party) => {
    // Only games that haven't finished count (old games used to block joining forever).
    const isAlreadyInAParty = upcomingParties.some(p => p.id !== party.id && p.members.includes(currentUser));
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
    return { text: "Join Party", disabled: false, className: "bg-red-600 text-white hover:bg-red-700" };
  };

  const handleNavigate = (item: Party | Venue) => {
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    let destinationParam = "";
    
    if ('placeId' in item && item.placeId) {
        const label = ('title' in item ? (item.venueName || item.title) : item.name) || 'Destination';
        destinationParam = `&destination_place_id=${item.placeId}&destination=${encodeURIComponent(label)}`;
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
      onClick={(e) => {
        // Clicks on our own bubbles/cards are handled by them.
        const dom = e.domEvent as MouseEvent | undefined;
        const target = dom?.target as HTMLElement | null;
        if (target?.closest?.('[data-map-overlay]') || Date.now() - overlayPressedAt.current < 600) return;
        // A drag (mouse moved while pressed) isn't a click.
        const down = leftDownAt.current;
        if (down && dom && typeof dom.clientX === 'number' && Math.hypot(dom.clientX - down.x, dom.clientY - down.y) > 6) return;
        // First click closes whatever is open; otherwise drop a pin to plan a game.
        if (selectedParty || selectedUser || selectedVenue) {
          setSelectedParty(null);
          setSelectedUser(null);
          setSelectedVenue(null);
          return;
        }
        if (e.latLng && onCreateAt) setDroppedPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }}
    >
      {/* "Plan a game here?" pin */}
      {droppedPin && onCreateAt && (
        <OverlayViewF position={droppedPin} mapPaneName={OverlayView.FLOAT_PANE}>
          <div data-map-overlay onPointerDown={markOverlayPress} className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center">
            <div className="mb-1 w-60 rounded-2xl bg-white shadow-elev-3 p-3 animate-in fade-in zoom-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Plan a game here?</p>
                  <p className="text-xs text-gray-500">{droppedPin.lat.toFixed(4)}, {droppedPin.lng.toFixed(4)}</p>
                </div>
                <button onClick={() => setDroppedPin(null)} aria-label="Cancel" className="press -mt-1 -mr-1 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 shrink-0">
                  <X size={18} />
                </button>
              </div>
              <button
                onClick={() => { onCreateAt(droppedPin); setDroppedPin(null); }}
                className="ripple press mt-2 w-full h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5"
              >
                <Plus size={18} /> Create game here
              </button>
            </div>
            <MapPin size={40} className="text-red-600 fill-red-600 drop-shadow-md [&_circle]:fill-white [&_circle]:stroke-white" />
          </div>
        </OverlayViewF>
      )}

      {isLive && (
        <MarkerF
          position={userLocation || center}
          icon={getMyMarkerIcon()}
          zIndex={1000}
          title="You are here (Live)"
        />
      )}

      {/* "Share my location" card, like a venue's card but at my position */}
      {shareCard && (
        <>
          {!isLive && <MarkerF position={shareCard.position} icon={getMyMarkerIcon()} zIndex={1000} title="You are here" />}
          <MapCard isPhone={isPhone} position={shareCard.position} offsetY={-18} onClose={shareCard.onClose} label="Share my location">
            {shareCard.content}
          </MapCard>
        </>
      )}

      {/* Parties as notes: the host's photo with a bubble saying what and when */}
      {upcomingParties.map((party) => {
        const config = sportConfigs?.find((c) => c.id === party.sport);
        const badgeUrl = directImageUrl(config?.markerUrl);
        const host = hostProfiles[party.hostUid];
        const hostName = host ? (host.display_name || host.displayName || host.username || party.host) : party.host;
        const avatar = host?.profile_img_url || host?.avatarUrl || fallbackAvatar(hostName || party.sport);
        const when = partyWhen(party);
        const selected = selectedParty?.id === party.id;
        const live = when === 'Playing now';
        return (
          <OverlayViewF
            key={party.id}
            position={{ lat: party.latitude, lng: party.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedParty(party);
                setSelectedUser(null);
                setSelectedVenue(null);
                setDroppedPin(null);
              }}
              data-map-overlay
              onPointerDown={markOverlayPress}
              aria-label={`${party.title}, ${when}, hosted by ${hostName}`}
              className="group absolute -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-pointer select-none"
            >
              <span className={`relative mb-2.5 w-max max-w-[160px] px-3 py-1.5 rounded-2xl bg-white shadow-elev-2 text-[12px] leading-[15px] text-left transition-transform duration-150 group-hover:-translate-y-0.5 ${selected ? 'ring-2 ring-red-500' : ''}`}>
                <span className="block font-semibold text-gray-900 truncate">{sportEmoji(party.sport)} {when}</span>
                <span className="flex gap-1 text-gray-600 min-w-0">
                  <span className="truncate">{party.title}</span>
                  <span className="shrink-0 text-gray-400">· {party.playersCurrent}/{party.playersMax}</span>
                </span>
                <span className="absolute -bottom-1.5 left-5 w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                <span className="absolute -bottom-3 left-3.5 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              </span>
              <span className={`relative w-11 h-11 rounded-full p-[2px] shadow-elev-2 transition-transform duration-150 group-hover:scale-105 ${live ? 'bg-gradient-to-tr from-red-600 to-orange-400' : 'bg-white'}`}>
                <img src={avatar} alt="" className="w-full h-full rounded-full object-cover bg-gray-100" referrerPolicy="no-referrer" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-[11px] leading-none">
                  {badgeUrl
                    ? <img src={badgeUrl} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                    : sportEmoji(party.sport)}
                </span>
              </span>
            </button>
          </OverlayViewF>
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
              data-map-overlay
              onPointerDown={markOverlayPress}
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

        {/* Venues: green droplet pins (sized to the map) with the main sport's icon. Hover for a photo + name. */}
        {venues.map((venue) => {
          const sports = Array.from(new Set(venue.courts.map((c) => c.sport)));
          const hovered = hoveredVenueId === venue.id && selectedVenue?.id !== venue.id;
          const pinW = venuePinWidth(zoom);
          const pinH = Math.round(pinW * 44 / 36);
          const ring = Math.round(pinW * 26 / 36);
          const showIcon = pinW >= 24;
          return (
            <OverlayViewF
              key={venue.id}
              position={{ lat: venue.latitude, lng: venue.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                data-map-overlay
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ zIndex: hovered ? 20 : undefined }}
                onMouseEnter={() => setHoveredVenueId(venue.id)}
                onMouseLeave={() => setHoveredVenueId((id) => (id === venue.id ? null : id))}
              >
                {hovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-2xl bg-white shadow-elev-3 overflow-hidden pointer-events-none animate-in fade-in zoom-in">
                    <VenuePhoto venue={venue} className="w-full h-28" />
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{venue.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 [&_img]:w-4 [&_img]:h-4 [&_svg]:w-4 [&_svg]:h-4">
                        {sports.map((s) => <span key={s} title={s} className="flex">{sportIconFor(s)}</span>)}
                        {venue.rating !== undefined && <span className="ml-auto"><span className="text-amber-500">★</span> {venue.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onPointerDown={markOverlayPress}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedParty(null);
                    setSelectedUser(null);
                    setDroppedPin(null);
                    setHoveredVenueId(null);
                    setSelectedVenue(venue);
                  }}
                  aria-label={venue.name}
                  // Small pins still get a finger-sized tap area; the tip stays on the spot.
                  className="flex items-end justify-center"
                  style={{ minWidth: 28, minHeight: 28 }}
                >
                  <span
                    className={`relative block origin-bottom transition-[width,height,transform] duration-200 ${hovered || selectedVenue?.id === venue.id ? 'scale-110' : 'hover:scale-110'}`}
                    style={{ width: pinW, height: pinH }}
                  >
                    <svg viewBox="0 0 36 44" className="absolute inset-0 w-full h-full drop-shadow-md" aria-hidden>
                      <path d="M18 1C8.6 1 1 8.6 1 18c0 12 15.4 23.9 16.1 24.4.5.4 1.3.4 1.8 0C19.6 41.9 35 30 35 18 35 8.6 27.4 1 18 1z" fill="#16a34a" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {showIcon ? (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white flex items-center justify-center text-gray-700 [&_img]:w-[62%] [&_img]:h-[62%] [&_svg]:w-[62%] [&_svg]:h-[62%]"
                        style={{ top: Math.round(pinW * 5 / 36), width: ring, height: ring }}
                      >
                        {sportIconFor(sports[0])}
                      </span>
                    ) : (
                      // Too small for an icon: just a white dot, like a map pin.
                      <span
                        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white"
                        style={{ top: Math.round(pinW * 11 / 36), width: Math.max(3, Math.round(pinW * 0.36)), height: Math.max(3, Math.round(pinW * 0.36)) }}
                      />
                    )}
                  </span>
                </button>
              </div>
            </OverlayViewF>
          );
        })}

      {selectedUser && (
        <MapCard
          isPhone={isPhone}
          position={{ lat: selectedUser.location.l[0], lng: selectedUser.location.l[1] }}
          offsetY={-30}
          onClose={() => setSelectedUser(null)}
          label="Player"
        >
          <div className="p-1 sm:p-3 w-full sm:w-auto sm:min-w-[220px] sm:max-w-[260px] flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onOpenProfile?.({
                uid: selectedUser.uid,
                preview: selectedUser.user,
                distanceM: selectedUser.precise_distance,
                lookingFor: selectedUser.location.sport,
              })}
              title="View profile"
              className="group flex items-center gap-3 text-left rounded-xl -m-1 p-1 hover:bg-gray-50"
            >
              <img
                src={selectedUser.user?.profile_img_url || selectedUser.user?.avatarUrl || fallbackAvatar(selectedUser.user?.display_name || 'Player')}
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover border border-gray-200 group-hover:ring-2 group-hover:ring-red-200"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <h3 className="font-bold text-base text-gray-900 leading-tight group-hover:underline">
                    {selectedUser.user?.display_name || selectedUser.user?.displayName || 'Unknown User'}
                </h3>
                <p className="text-xs text-gray-500">
                    {selectedUser.precise_distance < 1000
                      ? `${selectedUser.precise_distance.toFixed(0)} m away`
                      : `${(selectedUser.precise_distance / 1000).toFixed(1)} km away`}
                    <span className="text-red-600 font-medium"> · View profile</span>
                </p>
              </div>
            </button>

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
                
                if (broadcastedSport) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">Looking for:</span>
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                                {broadcastedSport === 'All' ? 'Any sport' : broadcastedSport}
                            </span>
                        </div>
                    );
                }

                if (sports.length > 0) {
                    return (
                        <div className="flex flex-wrap gap-1">
                            {sports.map((s: string) => (
                                <span key={s} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">
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
                    className="w-full mt-1 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                >
                    Add Friend
                </button>
            )}
          </div>
        </MapCard>
      )}

        {/* Venue details */}
        {selectedVenue && (
          <MapCard
            isPhone={isPhone}
            position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
            offsetY={-(Math.round(venuePinWidth(zoom) * 44 / 36) + 4)}
            onClose={() => setSelectedVenue(null)}
            label={selectedVenue.name}
          >
            <div className="w-full sm:w-[264px] font-sans">
              <VenuePhoto venue={selectedVenue} className="w-full h-36 sm:h-32 rounded-xl" />
              <div className="pt-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[15px] text-gray-900 leading-snug">{selectedVenue.name}</h3>
                  {selectedVenue.distance !== undefined && (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full" title="Straight-line distance">
                      <Navigation size={10} />
                      {formatDistance(selectedVenue.distance)}
                    </span>
                  )}
                </div>
                {selectedVenue.rating !== undefined && (
                  <p className="mt-0.5 text-xs text-gray-700">
                    <span className="text-amber-500">★</span> {selectedVenue.rating.toFixed(1)}
                    {selectedVenue.ratingCount ? <span className="text-gray-400"> ({selectedVenue.ratingCount} Google reviews)</span> : null}
                  </p>
                )}
                {selectedVenue.description && <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{selectedVenue.description}</p>}

                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">What you can play</p>
                <div className="mt-1.5 space-y-1.5">
                  {selectedVenue.courts.map((court, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                      <span className="w-9 h-9 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 [&_img]:w-5 [&_img]:h-5 [&_svg]:w-5 [&_svg]:h-5">
                        {sportIconFor(court.sport)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{court.name}</p>
                        <p className="text-xs text-gray-500">{court.sport}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {onCreateAt && (
                  <button
                    onClick={() => { onCreateAt({ lat: selectedVenue.latitude, lng: selectedVenue.longitude }, selectedVenue.name); setSelectedVenue(null); }}
                    className="ripple press mt-3 w-full h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> Plan a game here
                  </button>
                )}
                {onStartGroupAt && (
                  <button
                    onClick={() => { onStartGroupAt(selectedVenue); setSelectedVenue(null); }}
                    className="ripple press mt-2 w-full h-10 rounded-xl bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 flex items-center justify-center gap-1.5"
                  >
                    <UsersRound size={16} /> Start a group here
                  </button>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleNavigate(selectedVenue)}
                    className="ripple press h-9 rounded-xl bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <Navigation size={15} /> Directions
                  </button>
                  <button
                    onClick={() => onShareVenue(selectedVenue)}
                    className="ripple press h-9 rounded-xl bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <Send size={15} /> Share
                  </button>
                </div>
              </div>
            </div>
          </MapCard>
        )}

      {selectedParty && (
        <MapCard
          isPhone={isPhone}
          position={{ lat: selectedParty.latitude, lng: selectedParty.longitude }}
          offsetY={-100}
          onClose={() => setSelectedParty(null)}
          label={selectedParty.title}
        >
          <div className="p-1 w-full sm:min-w-[200px] sm:max-w-[240px]">
            <h3 className="font-bold text-lg mb-0.5 text-gray-800 leading-tight">{selectedParty.title}</h3>
            {selectedParty.venueName && (
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin size={10} /> {selectedParty.venueName}
                </p>
            )}
            
            <div className="flex items-center justify-between mb-2 mt-2">
                 <div className="flex items-center gap-1 text-xs font-semibold text-red-700 uppercase tracking-wider">
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
                          <button
                              key={member.uid}
                              type="button"
                              onClick={() => onOpenProfile?.({ uid: member.uid, preview: member })}
                              title={`${member.display_name || member.displayName || member.username} · View profile`}
                              className="press rounded-full"
                          >
                            <img
                                src={member.profile_img_url || member.avatarUrl || fallbackAvatar(member.display_name || member.username || 'Player')}
                                alt={member.displayName}
                                className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm hover:ring-2 hover:ring-red-200"
                            />
                          </button>
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
            {(selectedParty.members.includes(currentUser) || selectedParty.hostUid === currentUserUid) && (
              <div className="flex gap-2 mt-2">
                {onOpenPartyChat && (
                  <button
                    onClick={() => onOpenPartyChat(selectedParty)}
                    className="flex-1 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap bg-gray-100 text-gray-900 hover:bg-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={14} /> Group chat
                  </button>
                )}
                {onLeaveParty && selectedParty.hostUid !== currentUserUid && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Leave "${selectedParty.title}"?`)) { onLeaveParty(selectedParty.id); setSelectedParty(null); }
                    }}
                    className="flex-1 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap bg-gray-100 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={14} /> Leave game
                  </button>
                )}
              </div>
            )}
          </div>
        </MapCard>
      )}
    </GoogleMap>
  );
};

const MemoizedMapView = React.memo(MapView);
export default MemoizedMapView;
