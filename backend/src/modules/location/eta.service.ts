// src/modules/location/eta.service.ts
//
// ETA + reverse geocoding via Google Maps, with a graceful fallback. Distance Matrix is called
// with departure_time=now so it returns traffic-aware duration when available (traffic-ready).
// If no API key is configured or the call fails, falls back to straight-line distance at an
// assumed average speed so the feature still works in dev/offline.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineKm } from 'src/common/utils/geo.util';
import { FALLBACK_SPEED_KMH } from './enums';
import { EtaResult } from './interfaces';
import { GeoPoint } from './geofence.service';

@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY') ?? this.config.get<string>('maps.apiKey');
  }

  async estimate(origin: GeoPoint, destination: GeoPoint): Promise<EtaResult> {
    if (this.apiKey) {
      const viaGoogle = await this.distanceMatrix(origin, destination);
      if (viaGoogle) return viaGoogle;
    }
    return this.fallback(origin, destination);
  }

  private async distanceMatrix(origin: GeoPoint, destination: GeoPoint): Promise<EtaResult | null> {
    try {
      const params = new URLSearchParams({
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        departure_time: 'now', // enables duration_in_traffic when available
        key: this.apiKey!,
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
      const json: any = await res.json();
      const el = json?.rows?.[0]?.elements?.[0];
      if (el?.status !== 'OK') return null;
      const duration_s = el.duration_in_traffic?.value ?? el.duration?.value;
      const distance_m = el.distance?.value;
      if (duration_s == null || distance_m == null) return null;
      return { distance_m, duration_s, eta: new Date(Date.now() + duration_s * 1000), source: 'google' };
    } catch (err) {
      this.logger.warn(`Distance Matrix failed, using estimate: ${(err as Error).message}`);
      return null;
    }
  }

  private fallback(origin: GeoPoint, destination: GeoPoint): EtaResult {
    const distance_m = Math.round(haversineKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude) * 1000);
    const duration_s = Math.round((distance_m / 1000 / FALLBACK_SPEED_KMH) * 3600);
    return { distance_m, duration_s, eta: new Date(Date.now() + duration_s * 1000), source: 'estimate' };
  }

  async reverseGeocode(point: GeoPoint): Promise<string | null> {
    if (!this.apiKey) return null;
    try {
      const params = new URLSearchParams({ latlng: `${point.latitude},${point.longitude}`, key: this.apiKey });
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      const json: any = await res.json();
      return json?.results?.[0]?.formatted_address ?? null;
    } catch (err) {
      this.logger.warn(`Reverse geocode failed: ${(err as Error).message}`);
      return null;
    }
  }
}
