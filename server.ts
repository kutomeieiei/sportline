import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, startAt, endAt, getDocs, doc, getDoc } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Firebase Config for Server (using process.env)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase Client SDK on Server
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

interface ActiveLocation {
  id: string;
  g: string;
  l: [number, number];
  mode: string;
  vis: boolean;
  t: { toMillis?: () => number } | number | string | Date;
  uid?: string;
}

// API Endpoint: Two-Phase Discovery Pipeline
app.get('/api/discover', async (req, res) => {
  try {
    const { lat, lng, radiusInM, sport, limit } = req.query as { lat: string; lng: string; radiusInM: string; sport?: string; limit?: string };

    if (!lat || !lng || !radiusInM) {
      return res.status(400).json({ error: 'Missing lat, lng, or radiusInM' });
    }

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusInMeters = parseFloat(radiusInM);
    const maxResults = limit ? parseInt(limit, 10) : undefined;

    // Phase 1: Coarse Spatial Filter (Bounding Box Search)
    // Get Geohash bounds
    const bounds = geohashQueryBounds([centerLat, centerLng], radiusInMeters);
    
    const promises = [];
    for (const b of bounds) {
      const q = query(
        collection(db, 'active_locations'),
        orderBy('g'),
        startAt(b[0]),
        endAt(b[1])
      );
      promises.push(getDocs(q));
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
    let results = [];
    for (const docData of matchingDocs) {
      const lat = docData.l[0];
      const lng = docData.l[1];
      
      // Calculate precise distance
      const distanceInKm = distanceBetween([centerLat, centerLng], [lat, lng]);
      const distanceInMeters = distanceInKm * 1000;

      if (distanceInMeters <= radiusInMeters) {
        let userData = null;
        try {
            const userSnap = await getDoc(doc(db, 'users', docData.uid || docData.id));
            if (userSnap.exists()) {
                userData = userSnap.data();
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

    res.json({ results });

  } catch (error) {
    console.error('Error in /api/discover:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Vite middleware setup
import { createServer as createViteServer } from 'vite';

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
