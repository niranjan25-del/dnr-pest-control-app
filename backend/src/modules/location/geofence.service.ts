// src/modules/location/geofence.service.ts
//
// Geofencing via the customer address coordinates + a radius (haversine). There is no geofence
// entity in the schema — a geofence is computed from Address.latitude/longitude. When the
// address has no coordinates (geocoding optional, Step 8), distance checks are skipped and the
// caller decides how to proceed (flagged).

import { Injectable } from "@nestjs/common";
import { haversineKm } from "src/common/utils/geo.util";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeofenceService {
  /** Distance in metres between two points. */
  distanceMeters(a: GeoPoint, b: GeoPoint): number {
    return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
  }

  /** True if `point` is within `radiusMeters` of `center`. */
  isWithin(point: GeoPoint, center: GeoPoint, radiusMeters: number): boolean {
    return this.distanceMeters(point, center) <= radiusMeters;
  }

  /** Resolve a usable center from an address; null when coordinates are missing. */
  centerFromAddress(
    address: { latitude: unknown; longitude: unknown } | null,
  ): GeoPoint | null {
    if (!address || address.latitude == null || address.longitude == null)
      return null;
    return {
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
  }
}
