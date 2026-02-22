import { GoogleGenAI, Type } from "@google/genai";
import { User, SportType } from "../types";
import { calculateHaversineDistance } from "../utils/geospatial";

// Initialize Gemini API
const apiKey = (import.meta as any).env.VITE_GOOGLE_GENAI_API_KEY || (import.meta as any).env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface RankedUser {
  uid: string;
  compatibilityScore: number;
  reason: string;
}

export const rankUsers = async (
  currentUser: User,
  candidates: User[],
  userLocation: { lat: number; lng: number }
): Promise<RankedUser[]> => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Returning unranked list.");
    return candidates.map(c => ({ uid: c.uid, compatibilityScore: 0, reason: "API Key missing" }));
  }

  // --- TIER 1 & 2: Spatial Filtering ---
  // Filter candidates within 3km radius
  const nearbyCandidates = candidates.filter(candidate => {
    if (!candidate.static_coords) return false;
    const dist = calculateHaversineDistance(
      userLocation.lat,
      userLocation.lng,
      candidate.static_coords.lat,
      candidate.static_coords.lng
    );
    return dist <= 3; // 3km radius
  });

  if (nearbyCandidates.length === 0) {
    return [];
  }

  // Prepare data for Gemini
  const candidateData = nearbyCandidates.map(c => ({
    uid: c.uid,
    username: c.username,
    bio: c.bio,
    sports: c.preferredSports,
    skillLevel: c.skillLevel,
    locationMode: c.location_mode,
    distance: calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        c.static_coords!.lat,
        c.static_coords!.lng
    ).toFixed(2) + " km"
  }));

  const prompt = `
    You are an AI matchmaking engine for a sports app.
    
    Current User Profile:
    - Bio: ${currentUser.bio}
    - Sports: ${currentUser.preferredSports.join(", ")}
    - Skill Level: ${currentUser.skillLevel || "Unknown"}
    
    Candidate List:
    ${JSON.stringify(candidateData, null, 2)}
    
    Task:
    Rank the candidates based on compatibility with the current user.
    
    Ranking Criteria:
    1. Proximity: Closer is better (already filtered to < 3km).
    2. Status: Prioritize location_mode: "live".
    3. Attributes: Match sports and skill level.
    
    Output Format:
    Return a JSON array of objects with the following schema:
    {
      "uid": string,
      "compatibilityScore": number (0-100),
      "reason": string (short explanation)
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              uid: { type: Type.STRING },
              compatibilityScore: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    try {
        const rankedUsers = JSON.parse(text) as RankedUser[];
        return rankedUsers.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    } catch (e) {
        console.error("Failed to parse Gemini response:", e);
        return [];
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return [];
  }
};
