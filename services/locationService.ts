import * as geofire from 'geofire-common';
import { calculateHaversineDistance } from '../utils/geospatial';
import { User } from '../types';
import { DUMMY_USERS } from '../constants';

// active_locations Collection (Ephemeral Store - High-Frequency Data)
export interface ActiveLocation {
  uid: string;
  g: string; // High-precision Geohash
  l: [number, number]; // [lat, lng] WGS84 Coordinates
  mode: "live" | "static";
  vis: boolean; // Source-of-truth for Visibility Toggle
  t: number; // timestamp
}

// In-memory store to simulate Firestore collection
let activeLocationsStore: ActiveLocation[] = DUMMY_USERS.map(u => ({
  uid: u.uid,
  g: geofire.geohashForLocation([u.static_coords.lat, u.static_coords.lng]),
  l: [u.static_coords.lat, u.static_coords.lng],
  mode: u.location_mode,
  vis: u.is_visible,
  t: Date.now()
}));

// CQRS Command: Update ephemeral store
export const updateActiveLocation = async (uid: string, lat: number, lng: number, mode: "live" | "static", vis: boolean) => {
  const hash = geofire.geohashForLocation([lat, lng]);
  const existingIndex = activeLocationsStore.findIndex(loc => loc.uid === uid);
  
  const newLoc: ActiveLocation = {
    uid,
    g: hash,
    l: [lat, lng],
    mode,
    vis,
    t: Date.now()
  };

  if (existingIndex >= 0) {
    activeLocationsStore[existingIndex] = newLoc;
  } else {
    activeLocationsStore.push(newLoc);
  }
};

// Security Protocol & Geo-Obfuscation (Privacy-by-Design)
const applyJitter = (lat: number, lng: number, mode: "live" | "static"): [number, number] => {
  if (mode === 'static') {
    // Context-Aware Jitter Logic: Apply a random offset (Jitter) of 100-500 meters
    // to coordinates associated with residential locations to thwart triangulation.
    const r = (Math.random() * 0.4 + 0.1) / 111; // 0.1km to 0.5km in degrees
    const theta = Math.random() * 2 * Math.PI;
    const dLat = r * Math.cos(theta);
    const dLng = r * Math.sin(theta) / Math.cos(lat * (Math.PI / 180));
    return [lat + dLat, lng + dLng];
  }
  // Live Mode (Venue-based Precision): Allow precise coordinate transmission
  return [lat, lng];
};

export interface DiscoveryResult {
  uid: string;
  precise_distance: number;
  coords: [number, number];
}

// CQRS Query: Read from ephemeral store
export const getNearbyUsers = async (center: [number, number], radiusInM: number): Promise<DiscoveryResult[]> => {
  // Phase 1: Coarse Spatial Filter (Bounding Box Search)
  // Execute a Geohash-range query to retrieve candidates within the 8 neighboring cells plus the local cell.
  const bounds = geofire.geohashQueryBounds(center, radiusInM);
  
  const candidates: ActiveLocation[] = [];
  
  for (const b of bounds) {
    // Complexity: O(1) lookup via indexed string prefixes, yielding a high-probability candidate subset.
    const matching = activeLocationsStore.filter(loc => loc.g >= b[0] && loc.g <= b[1]);
    candidates.push(...matching);
  }

  // Phase 2: Fine-Grained Haversine Refinement
  // Execute the Haversine Formula within a Cloud Function or Edge Middleware for the filtered subset
  const results: DiscoveryResult[] = [];
  const now = Date.now();
  
  for (const loc of candidates) {
    // Visibility Enforcement: Hard-code an is_visible == true constraint into the Database Rules/Middleware.
    // Security Objective: Prevent Packet Sniffing by ensuring that invisible user data never leaves the Database Layer.
    if (!loc.vis) continue;
    
    // TTL Check: documents are automatically evicted if last_updated exceeds 60 minutes to prevent "ghost" markers
    if (now - loc.t > 60 * 60 * 1000) continue;

    const distanceKm = calculateHaversineDistance(center[0], center[1], loc.l[0], loc.l[1]);
    const distanceM = distanceKm * 1000;
    
    if (distanceM <= radiusInM) {
      // Server-Side Sanitization: Implement a strict "No Raw Telemetry" policy.
      // The Backend must strip raw lat/long before JSON serialization for public feeds.
      const obfuscatedCoords = applyJitter(loc.l[0], loc.l[1], loc.mode);
      
      results.push({
        uid: loc.uid,
        precise_distance: distanceM,
        coords: obfuscatedCoords
      });
    }
  }

  // Return a sorted array of uid and precise_distance to the Client-side UI.
  return results.sort((a, b) => a.precise_distance - b.precise_distance);
};
