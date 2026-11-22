import { db } from '../firebase';
import { Venue } from '../types';
import { KKU_VENUES } from '../data/kkuVenues';
import { calculateHaversineDistance } from '../utils/geospatial';

/** Venues added by admins (stored in the database). */
export const getVenues = async (): Promise<Venue[]> => {
  if (!db) return [];
  try {
    const snapshot = await db.collection('venues').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Venue[];
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
};

// Old versions of the app filled an empty database with made-up demo venues
// (random photos). They aren't real places, so they're hidden.
const DEMO_VENUE_NAMES = new Set([
  'Khon Kaen University Sports Complex',
  'Central Plaza Khon Kaen Badminton Courts',
  'Bueng Kaen Nakhon Park',
]);
const isDemoVenue = (v: Venue) => DEMO_VENUE_NAMES.has(v.name) && /picsum\.photos/.test(v.imageUrl || '');

/**
 * Admin venues + the built-in list of popular places around KKU. A built-in
 * place is skipped if an admin already added the same place (same Google place,
 * or within 40 m).
 */
export const mergeWithBuiltInVenues = (adminVenues: Venue[]): Venue[] => {
  const real = adminVenues.filter((v) => !isDemoVenue(v));
  const builtIn = KKU_VENUES.filter((b) => !real.some((v) =>
    (v.placeId && v.placeId === b.placeId)
    || calculateHaversineDistance(v.latitude, v.longitude, b.latitude, b.longitude) < 0.04,
  ));
  return [...real, ...builtIn];
};

export const addVenue = async (venue: Omit<Venue, 'id'>): Promise<void> => {
  if (!db) return;
  await db.collection('venues').add(venue);
};
