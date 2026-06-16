// src/modules/location/interfaces/index.ts

import { TechnicianTrackingStatus } from '../enums';

export interface LivePosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: Date;
}

export interface TrackingSnapshot {
  technician_id: string;
  status: TechnicianTrackingStatus;
  position: LivePosition | null;
  booking_id: string | null;
  updated_at: Date | null;
}

export interface EtaResult {
  distance_m: number;
  duration_s: number;
  eta: Date;
  source: 'google' | 'estimate';
}
