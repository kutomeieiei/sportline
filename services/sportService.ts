import { db } from '../firebase';
import { SportConfig, SportType } from '../types';

export const getSportConfigs = async (): Promise<SportConfig[]> => {
  if (!db) return [];
  try {
    const snapshot = await db.collection('sports').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SportConfig));
  } catch (error) {
    console.error("Error fetching sport configs:", error);
    return [];
  }
};

export const updateSportConfig = async (sportId: string, data: Partial<SportConfig>): Promise<void> => {
  if (!db) return;
  try {
    await db.collection('sports').doc(sportId).set(data, { merge: true });
  } catch (error) {
    console.error("Error updating sport config:", error);
    throw error;
  }
};
