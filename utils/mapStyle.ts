// Clean, light map like Google Maps, with business/shop pins hidden so
// games, players and venues stand out. Parks, water and roads stay visible.
export const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.government', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d8efd3' }] },
  { featureType: 'poi.sports_complex', elementType: 'geometry', stylers: [{ color: '#d8efd3' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fde7a9' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#aadaff' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];
