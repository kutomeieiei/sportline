import { db } from '../firebase';
import { Venue } from '../types';

export const getVenues = async (): Promise<Venue[]> => {
  if (!db) return [];

  try {
    const snapshot = await db.collection('venues').get();
    if (snapshot.empty) {
      console.log('No venues found, seeding initial data...');
      await seedVenues(); // Seed data if collection is empty
      const seededSnapshot = await db.collection('venues').get();
      return seededSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Venue[];
    }
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Venue[];
  } catch (error) {
    console.error("Error fetching venues:", error);
    return [];
  }
};

export const seedVenues = async (): Promise<void> => {
  if (!db) return;

  const venues: Omit<Venue, 'id'>[] = [
    {
      name: 'Khon Kaen University Sports Complex',
      description: 'A large sports complex with facilities for various sports. Open to students and the public.',
      imageUrl: 'https://picsum.photos/seed/kku/400/200',
      latitude: 16.4741,
      longitude: 102.8235,
      courts: [
        { name: 'Football Pitch 1', sport: 'Football' },
        { name: 'Basketball Court A', sport: 'Basketball' },
        { name: 'Tennis Court 3', sport: 'Tennis' },
      ]
    },
    {
      name: 'Central Plaza Khon Kaen Badminton Courts',
      description: 'Modern indoor badminton courts located on the top floor of the shopping mall.',
      imageUrl: 'https://picsum.photos/seed/central/400/200',
      latitude: 16.4299,
      longitude: 102.8344,
      courts: [
        { name: 'Badminton Court 1', sport: 'Badminton' },
        { name: 'Badminton Court 2', sport: 'Badminton' },
        { name: 'Badminton Court 3', sport: 'Badminton' },
        { name: 'Badminton Court 4', sport: 'Badminton' },
      ]
    },
    {
        name: 'Bueng Kaen Nakhon Park',
        description: 'A beautiful public park with a large lake, perfect for running and outdoor activities.',
        imageUrl: 'https://picsum.photos/seed/bueng/400/200',
        latitude: 16.4162,
        longitude: 102.8281,
        courts: [
            { name: 'Main Running Loop (2.8km)', sport: 'Running' },
            { name: 'Outdoor Fitness Zone', sport: 'Yoga' },
        ]
    }
  ];

  const batch = db.batch();

  venues.forEach(venue => {
    const docRef = db.collection('venues').doc();
    batch.set(docRef, venue);
  });

  try {
    await batch.commit();
    console.log('Successfully seeded venues.');
  } catch (error) {
    console.error('Error seeding venues:', error);
  }
};
