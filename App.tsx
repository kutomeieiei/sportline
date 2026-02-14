import React, { useState } from 'react';
import MapView from './components/MapView';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CreatePartyView from './components/CreatePartyView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ChatListView, { ChatUser } from './components/ChatListView';
import ChatDetailView from './components/ChatDetailView';
import { Party, SportType, User } from './types';
import { INITIAL_PARTIES, INITIAL_USER, KHON_KAEN_CENTER } from './constants';
// Added missing Loader2 import to fix "Cannot find name 'Loader2'" error.
import { Crosshair, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [user, setUser] = useState<User>(INITIAL_USER);
  const [parties, setParties] = useState<Party[]>(INITIAL_PARTIES);
  const [currentTab, setCurrentTab] = useState<'explore' | 'create' | 'settings' | 'chat'>('explore');
  const [mapCenter, setMapCenter] = useState(KHON_KAEN_CENTER);
  const [isAIRecommendationLoading, setIsAIRecommendationLoading] = useState(false);
  
  // Chat Navigation State
  const [selectedChatUser, setSelectedChatUser] = useState<ChatUser | null>(null);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentTab('explore');
    setSelectedChatUser(null);
  };

  // --- AI CONCIERGE MATCHMAKING (v2026 Spec) ---
  const handleAISuggestion = async () => {
    if (isAIRecommendationLoading) return;
    setIsAIRecommendationLoading(true);
    
    try {
      // Use direct API key reference from process.env.API_KEY as per Google GenAI guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        System: You are the "Sport Line" AI Concierge (v2026). Your goal is to provide semantic matchmaking.
        Analyze the following user profile and available sport sessions to find the most compatible match based on intent, play style, and interests.
        
        User Profile:
        - Bio: ${user.bio}
        - Sports: ${user.preferredSports.join(', ')}
        - Skill: ${user.skillLevel || 'N/A'}
        - Style: ${user.playStyle || 'N/A'}
        
        Available Sessions:
        ${parties.map(p => `- ID: ${p.id} | Title: ${p.title} | Sport: ${p.sport} | Description: ${p.description}`).join('\n')}
        
        Decision Factors:
        1. Sport type matching.
        2. Semantic similarity (e.g. cardio vs high-intensity).
        3. Skill level compatibility.
        
        Return the ID of the single best match and a short, friendly ice-breaker sentence (Thai or English based on user bio).
        Format: JSON { "bestMatchId": "id_string", "iceBreaker": "string" }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 } 
        }
      });

      const rawText = response.text || '{}';
      const result = JSON.parse(rawText);
      const suggestedParty = parties.find(p => p.id === result.bestMatchId);
      
      if (suggestedParty) {
        setMapCenter({ lat: suggestedParty.latitude, lng: suggestedParty.longitude });
        // Simulating a native toast/alert for the demo
        setTimeout(() => {
            alert(`🧠 AI Concierge Recommendation:\n\nMatch: ${suggestedParty.title}\n\nWhy: ${result.iceBreaker}`);
        }, 500);
      } else {
        alert("No perfect AI match found right now. Try expanding your interests!");
      }
    } catch (e) {
      console.error("AI Matchmaking Error:", e);
      alert("AI Concierge is offline. Please try again later.");
    } finally {
      setIsAIRecommendationLoading(false);
    }
  };

  // If not authenticated, show Login View
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Filter parties based on selection
  const filteredParties = selectedSport === 'All' 
    ? parties 
    : parties.filter(p => p.sport === selectedSport);

  const handleTabChange = (tab: 'explore' | 'create' | 'settings' | 'chat') => {
    setCurrentTab(tab);
    if (tab !== 'chat') {
        setSelectedChatUser(null);
    }
  };

  const handleCreateParty = (newParty: Party) => {
    setParties([...parties, newParty]);
    setCurrentTab('explore');
    setMapCenter({ lat: newParty.latitude, lng: newParty.longitude });
  };

  const handleJoinParty = (partyId: string) => {
    setParties(parties.map(party => {
        if (party.id === partyId) {
            if (party.members.includes(user.username) || party.playersCurrent >= party.playersMax) return party;
            return {
                ...party,
                playersCurrent: party.playersCurrent + 1,
                members: [...party.members, user.username]
            };
        }
        return party;
    }));
  };

  const handleRecenter = () => {
    // Add small noise to trigger map update if center is identical
    setMapCenter({ ...KHON_KAEN_CENTER, lat: KHON_KAEN_CENTER.lat + (Math.random() * 0.00001) });
  };
  
  const handleLocationSelect = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
      
      {/* Map Layer */}
      <div className="absolute inset-0 top-0 bottom-[72px] z-0">
        <MapView 
            parties={filteredParties} 
            center={mapCenter} 
            currentUser={user.username}
            onJoinParty={handleJoinParty}
        />
      </div>

      {/* Floating UI Elements */}
      {currentTab === 'explore' && (
        <>
          <TopBar 
            selectedSport={selectedSport} 
            onSelectSport={setSelectedSport}
            userAvatar={user.avatarUrl}
            onAvatarClick={() => setCurrentTab('settings')}
            onLocationSelect={handleLocationSelect}
          />

          <div className="absolute bottom-24 right-4 flex flex-col gap-3 z-[1000]">
            {/* AI Concierge Button */}
            <button 
              onClick={handleAISuggestion}
              disabled={isAIRecommendationLoading}
              className={`p-4 rounded-3xl shadow-2xl border border-white text-white transition-all transform active:scale-90 flex items-center justify-center
                ${isAIRecommendationLoading ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800'}`}
              title="AI Semantic Matchmaking"
            >
              {isAIRecommendationLoading ? <Loader2 size={28} className="animate-spin" /> : <BrainCircuit size={28} />}
              {isAIRecommendationLoading && <span className="absolute -top-10 right-0 bg-indigo-600 text-[10px] px-2 py-1 rounded-full whitespace-nowrap animate-bounce font-bold">GEMINI THINKING...</span>}
            </button>

            {/* Recenter Button */}
            <button 
              onClick={handleRecenter}
              className="bg-white p-4 rounded-full shadow-2xl text-gray-700 hover:text-red-600 border border-gray-100 transition-colors"
            >
              <Crosshair size={28} />
            </button>
          </div>
        </>
      )}

      {/* Overlay Views */}
      {currentTab === 'create' && (
        <CreatePartyView 
          onClose={() => setCurrentTab('explore')} 
          onCreate={handleCreateParty}
          userLocation={mapCenter}
          currentUser={user.username}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView 
          user={user}
          onUpdateUser={setUser}
          onClose={() => setCurrentTab('explore')}
          onLogout={handleLogout}
        />
      )}

      {/* Chat Views */}
      {currentTab === 'chat' && (
        <div className="absolute inset-0 bottom-[72px] z-[1000] bg-white">
            {selectedChatUser ? (
                <ChatDetailView 
                    chatUser={selectedChatUser} 
                    onBack={() => setSelectedChatUser(null)} 
                />
            ) : (
                <ChatListView 
                    onSelectChat={setSelectedChatUser} 
                />
            )}
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />

    </div>
  );
}

export default App;