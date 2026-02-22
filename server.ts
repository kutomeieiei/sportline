import express from 'express';
import { getGeohashRange } from 'geofire-common';
import { db } from './services/firebaseService';
import { calculateHaversineDistance } from './utils/geospatial';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/discover', async (req, res) => {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: 'Missing required query parameters: lat, lng, radius' });
    }

    const center = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const radiusInM = parseFloat(radius as string) * 1000; // Convert km to meters

    // Phase 1: Coarse Spatial Filter (Bounding Box Search)
    const bounds = getGeohashRange(center.lat, center.lng, radiusInM);
    const promises = [];
    for (const b of bounds) {
      const q = db.collection('active_locations')
        .orderBy('g')
        .startAt(b[0])
        .endAt(b[1]);
      promises.push(q.get());
    }

    const snapshots = await Promise.all(promises);
    const matchingDocs = [];
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        matchingDocs.push(doc.data());
      }
    }

    // Phase 2: Fine-Grained Haversine Refinement
    const refinedResults = matchingDocs.filter(doc => {
      const distance = calculateHaversineDistance(center.lat, center.lng, doc.l.latitude, doc.l.longitude);
      return distance < radiusInM / 1000; // aversine returns km
    }).map(doc => {
      const distance = calculateHaversineDistance(center.lat, center.lng, doc.l.latitude, doc.l.longitude);
      return { ...doc, distance };
    }).sort((a, b) => a.distance - b.distance);

    res.json(refinedResults);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
