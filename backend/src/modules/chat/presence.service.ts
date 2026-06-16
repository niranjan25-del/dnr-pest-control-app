// src/modules/chat/presence.service.ts
//
// Online-presence tracking. A user may have multiple sockets (devices/tabs); we track the set
// per user and only flip online→offline when the last socket disconnects. last-seen is kept
// here too.
//
// ⚠ SCALING (flagged): this is in-process memory — correct for a single instance only. Across
// multiple instances, presence must live in a shared store (Redis). The Socket.IO Redis
// adapter handles cross-instance event delivery; presence state should move to Redis keys with
// TTL. There is also no last-seen column on User, so last-seen is not durable across restarts.

import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly sockets = new Map<string, Set<string>>(); // userId → socketIds
  private readonly lastSeenAt = new Map<string, Date>();

  /** Returns true if this is the user's first active socket (i.e. they just came online). */
  add(userId: string, socketId: string): boolean {
    const set = this.sockets.get(userId) ?? new Set<string>();
    const wasOffline = set.size === 0;
    set.add(socketId);
    this.sockets.set(userId, set);
    return wasOffline;
  }

  /** Returns true if the user has no remaining sockets (i.e. they just went offline). */
  remove(userId: string, socketId: string): boolean {
    const set = this.sockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.sockets.delete(userId);
      this.lastSeenAt.set(userId, new Date());
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  lastSeen(userId: string): Date | null {
    return this.isOnline(userId) ? new Date() : this.lastSeenAt.get(userId) ?? null;
  }
}
