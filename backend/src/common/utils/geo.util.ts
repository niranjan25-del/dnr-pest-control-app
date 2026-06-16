// src/common/utils/geo.util.ts
//
// Great-circle distance (Haversine) in kilometres + a radius containment helper. Reusable by
// dispatch (distance scoring) and service-area radius checks (once center/radius columns exist).

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  return haversineKm(point.lat, point.lng, center.lat, center.lng) <= radiusKm;
}
