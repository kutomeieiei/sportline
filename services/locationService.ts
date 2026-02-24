import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { LocationMode } from '../types';

export const updateLocation = async (
  uid: string,
  lat: number,
  lng: number,
  mode: LocationMode,
  vis: boolean,
  sport?: string
) => {
  const hash = geohashForLocation([lat, lng]);

  const locationRef = doc(db, 'active_locations', uid);

  const data: any = {
    uid,
    g: hash,
    l: [lat, lng], // Store as array for geofire compatibility or GeoPoint if preferred
    mode,
    vis,
    t: serverTimestamp(), // Server-side timestamp for TTL
  };

  if (sport !== undefined) {
    data.sport = sport;
  }

  await setDoc(locationRef, data, { merge: true });
};
