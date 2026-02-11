import { Party, User, SportType } from './types';
import { Trophy, Dribbble, Activity, PersonStanding, Dumbbell, Bike, Footprints, LayoutGrid, Circle} from 'lucide-react';
import React from 'react';

// --- APP CONFIGURATION ---
export const APP_CONFIG = {
  // ✨ CONFIGURATION: Main Logo (Large) - Used in Landing Center and Login Form
  logoUrl: "https://cdn.discordapp.com/attachments/1198199524955529287/1470809699958919291/1770738733559.png?ex=698ca5c6&is=698b5446&hm=cca50750ea0f29f363cf6d7fff247e21c3b2f78d87d064ec017f58581d8f79f5&", 
  
  // ✨ CONFIGURATION: Header Logo (Small) - Used in Top Left Bar
  headerLogoUrl: "https://cdn.discordapp.com/attachments/1198199524955529287/1470810545341989091/1770738946579.png?ex=698ca690&is=698b5510&hm=d10980d42133177608b82d7c7059f63857fb163b0920be6e5cf288ed86e14c68&", 

  appName: "Sport Line",
  primaryGradient: "bg-gradient-to-r from-red-500 to-pink-600",
  textGradient: "bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-pink-600"
};

// Default map center (Khon Kaen as requested)
export const KHON_KAEN_CENTER = { lat: 16.4322, lng: 102.8236 };
export const DEFAULT_CENTER = KHON_KAEN_CENTER; 
export const DEFAULT_CITY = "Khon Kaen";

export const INITIAL_USER: User = {
  username: "calyxohm",
  displayName: "CalyxOhm",
  avatarUrl: "https://picsum.photos/200/200",
  bio: "Just a sports fan! Love meeting new people for a game.",
  gender: "Prefer not to say",
  preferredSports: ['Football', 'Badminton']
};

export const SPORTS_LIST: { type: SportType; label: string; icon?: React.ReactNode }[] = [
  { type: 'All', label: 'All Sports', icon: <LayoutGrid size={16} /> },
  { type: 'Football', label: 'Football', icon: <Circle size={16} /> },
  { type: 'Basketball', label: 'Basketball', icon: <Dribbble size={16} /> },
  { type: 'Badminton', label: 'Badminton', icon: <Dumbbell size={16} /> },
  { type: 'Tennis', label: 'Tennis', icon: <Activity size={16} /> },
  { type: 'Running', label: 'Running', icon: <Footprints size={16} /> },
  { type: 'Cycling', label: 'Cycling', icon: <Bike size={16} /> },
  { type: 'Yoga', label: 'Yoga', icon: <PersonStanding size={16} /> },
];

export const INITIAL_PARTIES: Party[] = [
  {
    id: '1',
    title: 'Evening 5v5 Match',
    sport: 'Football',
    description: 'Casual game, need 2 more players.',
    date: '2023-10-25',
    startTime: '18:00',
    endTime: '20:00',
    playersCurrent: 8,
    playersMax: 10,
    latitude: 16.4322 + 0.002,
    longitude: 102.8236 + 0.002,
    host: 'JohnDoe',
    members: ['JohnDoe', 'Player2', 'Player3', 'Player4', 'Player5', 'Player6', 'Player7', 'Player8']
  },
  {
    id: '2',
    title: 'Morning Badminton',
    sport: 'Badminton',
    description: 'Doubles practice, intermediate level.',
    date: '2023-10-26',
    startTime: '08:00',
    endTime: '10:00',
    playersCurrent: 2,
    playersMax: 4,
    latitude: 16.4322 - 0.003,
    longitude: 102.8236 - 0.001,
    host: 'JaneSmith',
    members: ['JaneSmith', 'Partner1']
  }
];