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
  host: string;
  members: string[];
}

export interface LocationState {
  lat: number;
  lng: number;
}