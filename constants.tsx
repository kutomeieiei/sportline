import { Party, User, SportType } from './types';
import React from 'react';
import {Footprints, Bike, PersonStanding, Activity} from 'lucide-react';

export const parseGoogleDriveLink = (url: string): string => {
    if (!url) return url;
    if (url.includes('drive.google.com/file/d/')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return url;
};

export const APP_CONFIG = {
  // ✨ CONFIGURATION: Main Logo (Large) - Used in Landing Center and Login Form
  logoUrl: parseGoogleDriveLink(""), 
  
  // ✨ CONFIGURATION: Header Logo (Small) - Used in Top Left Bar
  headerLogoUrl: parseGoogleDriveLink(""), 

  appName: "SportSphere",
  primaryGradient: "bg-gradient-to-r from-red-600 to-red-800",
  textGradient: "bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-red-700"
};

// Default map center (Khon Kaen as requested)
export const KHON_KAEN_CENTER = { lat: 16.4322, lng: 102.8236 };
export const DEFAULT_CENTER = KHON_KAEN_CENTER; 
export const DEFAULT_CITY = "Khon Kaen";

export const INITIAL_USER: User = {
  uid: "guest_user",
  username: "calyxohm",
  displayName: "CalyxOhm",
  email: "calyxohm@example.com",
  avatarUrl: "https://picsum.photos/200/200",
  bio: "Just a sports fan! Love meeting new people for a game.",
  gender: "Prefer not to say",
  preferredSports: ['Football', 'Badminton']
};

// ✨ CUSTOMIZATION: Helper for consistent icon sizing
// Replace the 'src' string with your own image URL
const SportIcon = ({ src }: { src: string }) => (
  <img src={src} className="w-5 h-5 object-contain" alt="sport-icon" />
);

export const SPORTS_LIST: { type: SportType; label: string; icon: React.ReactNode }[] = [
  { 
    type: 'All', 
    label: 'All Sports', 
    icon: <Activity size={16} /> 
  },
  { 
    type: 'Football', 
    label: 'Football', 
    icon: <SportIcon src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26bd.png" /> 
  },
  { 
    type: 'Basketball', 
    label: 'Basketball', 
    icon: <SportIcon src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3c0.png" /> 
  },
  { 
    type: 'Badminton', 
    label: 'Badminton', 
    icon: <SportIcon src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3f8.png" /> 
  },
  { 
    type: 'Tennis', 
    label: 'Tennis', 
    icon: <SportIcon src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3be.png" /> 
  },
  { 
    type: 'Running', 
    label: 'Running', 
    icon: <Footprints size={16}/> 
  },
  { 
    type: 'Cycling', 
    label: 'Cycling', 
    icon: <Bike size={16} /> 
  },
  { 
    type: 'Yoga', 
    label: 'Yoga', 
    icon: <PersonStanding size={16} /> 
  },
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
  },
  {
    id: '3',
    title: 'Morning Badminton',
    sport: 'Badminton',
    description: 'Doubles practice, intermediate level.',
    date: '2023-10-26',
    startTime: '08:00',
    endTime: '10:00',
    playersCurrent: 2,
    playersMax: 4,
    latitude: 16.4809,
    longitude: 102.8291,
    host: 'JaneSmith',
    members: ['JaneSmith', 'Partner1']
  },
  {
    id: '4',
    title: 'Basketball ห้าๆ',
    sport: 'Basketball',
    description: 'เล่นบาสโหดๆ',
    date: '2025-2-11',
    startTime: '08:00',
    endTime: '10:00',
    playersCurrent: 2,
    playersMax: 10,
    latitude: 16.4813,
    longitude: 102.8312,
    host: 'หมาก',
    members: ['หมาก', 'กิว']
  }
];