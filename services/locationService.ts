import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { LocationMode } from '../types';

export const updateLocation = async (
  uid: string,
  lat: number,
  lng: number,
  mode: LocationMode,
  vis: boolean
) => {
  const hash = geohashForLocation([lat, lng]);

  const locationRef = doc(db, 'active_locations', uid);

  await setDoc(locationRef, {
    uid,
    g: hash,
    l: [lat, lng], // Store as array for geofire compatibility or GeoPoint if preferred
    mode,
    vis,
    t: serverTimestamp(), // Server-side timestamp for TTL
  }, { merge: true });
};
