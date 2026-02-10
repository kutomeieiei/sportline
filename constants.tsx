import { Party, User, SportType } from './types';
import { Trophy, Activity, PersonStanding, Dumbbell, Bike, Footprints } from 'lucide-react';
import React from 'react';

// Default map center (Bangkok, matching the user's screenshot vibe, or a generic city)
// Let's use a generic metropolitan area.
export const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }; // Bangkok

export const INITIAL_USER: User = {
  username: "calyxohm",
  displayName: "CalyxOhm",
  avatarUrl: "https://picsum.photos/200/200",
  bio: "Just a sports fan! Love meeting new people for a game.",
  gender: "Prefer not to say",
  preferredSports: ['Football', 'Badminton']
};

export const SPORTS_LIST: { type: SportType; label: string; icon?: React.ReactNode }[] = [
  { type: 'All', label: 'All Sports', icon: <Activity size={16} /> },
  { type: 'Football', label: 'Football', icon: <Trophy size={16} /> },
  { type: 'Basketball', label: 'Basketball', icon: <Activity size={16} /> },
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
    time: '18:00',
    playersCurrent: 8,
    playersMax: 10,
    latitude: 13.7563 + 0.002,
    longitude: 100.5018 + 0.002,
    host: 'JohnDoe'
  },
  {
    id: '2',
    title: 'Morning Badminton',
    sport: 'Badminton',
    description: 'Doubles practice, intermediate level.',
    date: '2023-10-26',
    time: '08:00',
    playersCurrent: 2,
    playersMax: 4,
    latitude: 13.7563 - 0.003,
    longitude: 100.5018 - 0.001,
    host: 'JaneSmith'
  },
  {
    id: '3',
    title: 'City Run',
    sport: 'Running',
    description: '10km easy pace around the park.',
    date: '2023-10-26',
    time: '06:30',
    playersCurrent: 5,
    playersMax: 20,
    latitude: 13.7563 + 0.005,
    longitude: 100.5018 - 0.005,
    host: 'RunnerX'
  },
  {
    id: '4',
    title: 'Street Basketball',
    sport: 'Basketball',
    description: '3v3 pickup games.',
    date: '2023-10-25',
    time: '17:00',
    playersCurrent: 3,
    playersMax: 6,
    latitude: 13.7563 - 0.002,
    longitude: 100.5018 + 0.004,
    host: 'HoopsLife'
  }
];