// src/modules/location/tracking.service.ts
//
// In-memory tracking session state per technician (status + last position + active booking).
//
// ⚠ SCALING (flagged): this is process-local. Across multiple instances, session state and the
// online set must live in Redis (keys with TTL) so any node can answer "where/what status is
// technician X". The durable record is TechnicianLocation (RouteService); this is the live
// view only.

import { Injectable } from "@nestjs/common";
import { TechnicianTrackingStatus } from "./enums";
import { LivePosition } from "./interfaces";

interface Session {
  status: TechnicianTrackingStatus;
  position: LivePosition | null;
  bookingId: string | null;
  arrivedNotified: boolean;
  updatedAt: Date;
}

@Injectable()
export class TrackingService {
  private readonly sessions = new Map<string, Session>(); // technicianId → session

  start(technicianId: string, bookingId?: string): Session {
    const session: Session = {
      status: bookingId
        ? TechnicianTrackingStatus.TRAVELING
        : TechnicianTrackingStatus.AVAILABLE,
      position: null,
      bookingId: bookingId ?? null,
      arrivedNotified: false,
      updatedAt: new Date(),
    };
    this.sessions.set(technicianId, session);
    return session;
  }

  stop(technicianId: string): void {
    this.sessions.delete(technicianId);
  }

  setStatus(technicianId: string, status: TechnicianTrackingStatus): Session {
    const s = this.sessions.get(technicianId) ?? this.start(technicianId);
    s.status = status;
    s.updatedAt = new Date();
    if (status !== TechnicianTrackingStatus.ARRIVED) s.arrivedNotified = false;
    this.sessions.set(technicianId, s);
    return s;
  }

  updatePosition(technicianId: string, position: LivePosition): Session {
    const s = this.sessions.get(technicianId) ?? this.start(technicianId);
    s.position = position;
    s.updatedAt = position.recordedAt;
    this.sessions.set(technicianId, s);
    return s;
  }

  markArrivedNotified(technicianId: string): void {
    const s = this.sessions.get(technicianId);
    if (s) s.arrivedNotified = true;
  }

  get(technicianId: string): Session | null {
    return this.sessions.get(technicianId) ?? null;
  }

  isOnline(technicianId: string): boolean {
    const s = this.sessions.get(technicianId);
    return Boolean(s && s.status !== TechnicianTrackingStatus.OFFLINE);
  }
}
