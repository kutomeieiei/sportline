import { DiscoveryResult } from '../types';

export const discoverUsers = async (
  lat: number,
  lng: number,
  radiusInM: number,
  sport?: string,
  limit?: number
): Promise<DiscoveryResult[]> => {
  try {
    let url = `/api/discover?lat=${lat}&lng=${lng}&radiusInM=${radiusInM}`;
    if (sport && sport !== 'All') {
      url += `&sport=${encodeURIComponent(sport)}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }
    const response = await fetch(url);
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
