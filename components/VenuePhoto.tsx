import React, { useEffect, useState } from 'react';
import { Venue } from '../types';
import { sportEmoji } from '../utils/party';

// ---------------------------------------------------------------------------
// Venue photos come from Google Maps. Photo links from Google expire, so we
// don't store them: we ask Google for the place's photo when it's shown, and
// remember the answer while the page is open.
// ---------------------------------------------------------------------------
const photoCache = new Map<string, Promise<string | null>>();

const loadGooglePhoto = (venue: Venue): Promise<string | null> => {
  const key = venue.placeId || `${venue.name}@${venue.latitude.toFixed(4)},${venue.longitude.toFixed(4)}`;
  const cached = photoCache.get(key);
  if (cached) return cached;
  const promise = new Promise<string | null>((resolve) => {
    if (typeof google === 'undefined' || !google.maps?.places) { resolve(null); return; }
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    const pick = (photos?: google.maps.places.PlacePhoto[]) =>
      resolve(photos?.[0]?.getUrl({ maxWidth: 640, maxHeight: 400 }) || null);
    if (venue.placeId) {
      service.getDetails({ placeId: venue.placeId, fields: ['photos'] }, (place, status) =>
        pick(status === google.maps.places.PlacesServiceStatus.OK ? place?.photos : undefined));
    } else {
      // Admin-added venue without a Google place: look it up by name near its pin.
      service.findPlaceFromQuery({
        query: venue.name,
        fields: ['photos'],
        locationBias: { center: { lat: venue.latitude, lng: venue.longitude }, radius: 300 },
      }, (places, status) => pick(status === google.maps.places.PlacesServiceStatus.OK ? places?.[0]?.photos : undefined));
    }
  });
  photoCache.set(key, promise);
  return promise;
};

// Links that are web pages or random placeholders, not real photos of the place.
const isUsableImageUrl = (url?: string) =>
  !!url && /^https?:\/\//.test(url) && !/picsum\.photos/.test(url);

/**
 * A venue's photo: the admin's picture if it loads, otherwise the Google Maps
 * photo, otherwise a simple placeholder with the venue's sports.
 */
const VenuePhotoInner: React.FC<{ venue: Venue; className?: string }> = ({ venue, className = '' }) => {
  const [src, setSrc] = useState<string | null>(isUsableImageUrl(venue.imageUrl) ? venue.imageUrl : null);
  const [triedGoogle, setTriedGoogle] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const tryGooglePhoto = () => {
    if (triedGoogle) { setSrc(null); return; }
    setTriedGoogle(true);
    loadGooglePhoto(venue).then((url) => setSrc(url));
  };

  // No usable picture of our own: go straight to Google.
  useEffect(() => {
    if (!isUsableImageUrl(venue.imageUrl)) tryGooglePhoto();
  }, [venue.id]);

  const sports = Array.from(new Set(venue.courts.map((c) => c.sport)));
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-red-50 to-orange-50 ${className}`}>
      {/* Placeholder (also shown while the photo loads) */}
      {(!src || !loaded) && (
        <div className={`absolute inset-0 flex items-center justify-center gap-2 text-3xl ${src ? 'skeleton' : ''}`}>
          {!src && sports.slice(0, 3).map((s) => <span key={s}>{sportEmoji(s)}</span>)}
        </div>
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt={venue.name}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(false); tryGooglePhoto(); }}
          className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
};

// Start fresh for each venue (the same popup can switch between venues).
const VenuePhoto: React.FC<{ venue: Venue; className?: string }> = (props) => (
  <VenuePhotoInner key={props.venue.id} {...props} />
);

export default VenuePhoto;
