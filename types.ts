export type SportType = 'All' | 'Football' | 'Basketball' | 'Badminton' | 'Tennis' | 'Running' | 'Cycling' | 'Yoga';

export interface User {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  gender: string;
  preferredSports: SportType[];
}

export interface Party {
  id: string;
  title: string;
  sport: SportType;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  playersCurrent: number;
  playersMax: number;
  latitude: number;
  longitude: number;
  
  // Google Places Data
  placeId?: string;
  venueName?: string;

  // Tier 1: Geohash for spatial indexing
  geohash?: string; 
  // Tier 2: Runtime distance from user/center in km
  distance?: number; 
  // Tier 3: Real-time Travel Time (e.g., "12 mins")
  travelTime?: string;

  host: string;
  members: string[];
}

export interface LocationState {
  lat: number;
  lng: number;
}