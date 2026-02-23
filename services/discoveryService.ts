import { DiscoveryResult } from '../types';

export const discoverUsers = async (
  lat: number,
  lng: number,
  radiusInM: number
): Promise<DiscoveryResult[]> => {
  try {
    const response = await fetch(`/api/discover?lat=${lat}&lng=${lng}&radiusInM=${radiusInM}`);
    if (!response.ok) {
      throw new Error('Failed to fetch discovery results');
    }
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Discovery failed:', error);
    return [];
  }
};
