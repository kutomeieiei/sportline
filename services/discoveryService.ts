import { DiscoveryResult } from '../types';
import { db } from '../firebase';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

export const discoverUsers = async (
  lat: number,
  lng: number,
  radiusInM: number,
  sport?: string,
  limit?: number
): Promise<DiscoveryResult[]> => {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const centerLat = lat;
    const centerLng = lng;
    const radiusInMeters = radiusInM;
    const maxResults = limit;

    // Phase 1: Coarse Spatial Filter (Bounding Box Search)
    const bounds = geohashQueryBounds([centerLat, centerLng], radiusInMeters);
    
    const promises = [];
    for (const b of bounds) {
      const q = db.collection('active_locations')
        .orderBy('g')
        .startAt(b[0])
        .endAt(b[1]);
      promises.push(q.get());
    }

    const snapshots = await Promise.all(promises);
    const matchingDocs: any[] = [];

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data();
        // Filter out invisible users
        if (data.vis === false) continue;
        
        // Filter by sport if provided
        if (sport && sport !== 'All' && data.sport !== sport) continue;
        
        // Check TTL (60 minutes)
        if (data.t) {
            const now = new Date().getTime();
            const t = data.t;
            const updatedAt = (typeof t === 'object' && 'toMillis' in t && typeof t.toMillis === 'function') 
                ? t.toMillis() 
                : new Date(t as string | number | Date).getTime();
                
            if (now - updatedAt > 60 * 60 * 1000) {
                continue; // Skip stale data
            }
        }

        matchingDocs.push({ id: doc.id, ...data });
      }
    }

    // Phase 2: Fine-Grained Haversine Refinement
    let results: DiscoveryResult[] = [];
    for (const docData of matchingDocs) {
      const docLat = docData.l[0];
      const docLng = docData.l[1];
      
      // Calculate precise distance
      const distanceInKm = distanceBetween([centerLat, centerLng], [docLat, docLng]);
      const distanceInMeters = distanceInKm * 1000;

      if (distanceInMeters <= radiusInMeters) {
        let userData = undefined;
        try {
            const userSnap = await db.collection('users').doc(docData.uid || docData.id).get();
            if (userSnap.exists) {
                userData = userSnap.data() as any;
            }
        } catch (e) {
            console.warn(`Failed to fetch user data for ${docData.uid}`, e);
        }

        results.push({
          uid: docData.uid || docData.id,
          precise_distance: distanceInMeters,
          location: docData,
          user: userData
        });
      }
    }

    // Sort by distance
    results.sort((a, b) => a.precise_distance - b.precise_distance);

    // Apply limit if provided
    if (maxResults && maxResults > 0) {
      results = results.slice(0, maxResults);
    }

    return results;
  } catch (error) {
    console.error('Discovery failed:', error);
    return [];
  }
};
