export type SportType = 'All' | 'Football' | 'Basketball' | 'Badminton' | 'Tennis' | 'Running' | 'Cycling' | 'Yoga';

export interface SkillMetrics {
  endurance: number;
  speed: number;
  technique: number;
  teamwork: number;
}

export interface User {
  uid: string;
  display_name: string;
  profile_img_url: string;
  preferred_sports: SportType[];
  skill_metrics: SkillMetrics;
  // Legacy fields for compatibility
  username?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  gender?: string;
  friends?: string[]; // Array of UIDs
}

export interface FriendRequest {
  id: string;
  from: string; // UID
  to: string; // UID
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: FirestoreTimestamp | Date | string | number; // Firestore Timestamp
  fromUser?: User; // Hydrated user data
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: FirestoreTimestamp | Date | string | number; // Firestore Timestamp
}

export interface ChatConversation {
  id: string;
  participants: string[]; // Array of UIDs
  lastMessage?: string;
  lastMessageTimestamp?: FirestoreTimestamp | Date | string | number;
  updatedAt: FirestoreTimestamp | Date | string | number;
  participantUsers?: User[]; // Hydrated user data
}

export type LocationMode = 'live' | 'static';

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
  toMillis?: () => number;
}

export interface ActiveLocation {
  uid: string; // Document ID is usually the user ID
  g: string; // Geohash
  l: [number, number]; // [latitude, longitude]
  mode: LocationMode;
  vis: boolean; // Visibility toggle
  t: FirestoreTimestamp | Date | number | string; // Timestamp (Firestore Timestamp or Date)
}

export interface DiscoveryResult {
  uid: string;
  precise_distance: number; // in meters or km
  location: ActiveLocation;
  user?: User; // Hydrated user data
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
  hostUid: string;
  members: string[];
}

export interface LocationState {
  lat: number;
  lng: number;
}

export interface Court {
  name: string;
  sport: SportType;
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  courts: Court[];
}