// src/modules/location/enums/index.ts
//
// Tracking status (app-level), socket event names, and geofence/ETA constants.
//
// NOTE (schema reconciliation): there is no technician-status column or TrackingSession table.
// The six tracking statuses are session state held in TrackingService (in-memory) and broadcast
// over the socket — not persisted. TechnicianLocation rows are the durable record (history /
// route playback). Multi-instance correctness requires moving session state to Redis (flagged).

export enum TechnicianTrackingStatus {
  OFFLINE = "OFFLINE",
  AVAILABLE = "AVAILABLE",
  TRAVELING = "TRAVELING",
  ARRIVED = "ARRIVED",
  WORKING = "WORKING",
  COMPLETED = "COMPLETED",
}

export const LOCATION_NAMESPACE = "/location";

export const LocationEvent = {
  LOCATION_UPDATE: "location:update",
  ONLINE: "technician:online",
  OFFLINE: "technician:offline",
  ARRIVED: "technician:arrived",
  WORKING: "technician:working",
  COMPLETED: "technician:completed",
  ERROR: "location:error",
} as const;

export const roomForBooking = (bookingId: string) =>
  `track:booking:${bookingId}`;
export const roomForTechnician = (technicianId: string) =>
  `track:tech:${technicianId}`;

// Geofence + check-in tolerances (metres).
export const GEOFENCE_ARRIVAL_RADIUS_M = 150; // proximity that flips tracking status to ARRIVED
export const CHECK_IN_RADIUS_M = 200; // max distance allowed to check in at a job

// Fallback ETA when Google Maps isn't configured/available.
export const FALLBACK_SPEED_KMH = 30;
export const ETA_TTL_SECONDS = 60;
