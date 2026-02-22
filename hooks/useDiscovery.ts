import { useQuery } from '@tanstack/react-query';

async function fetchDiscoveryData(lat: number, lng: number, radius: number) {
  const response = await fetch(`/api/discover?lat=${lat}&lng=${lng}&radius=${radius}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
}

export function useDiscovery(lat: number, lng: number, radius: number) {
  return useQuery({
    queryKey: ['discovery', lat, lng, radius],
    queryFn: () => fetchDiscoveryData(lat, lng, radius),
    enabled: !!lat && !!lng && !!radius,
  });
}
