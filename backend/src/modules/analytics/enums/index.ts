// src/modules/analytics/enums/index.ts
//
// Granularity, report types, export formats, and a tiny in-memory TTL cache.
//
// ⚠ CACHING (flagged): the cache below is process-local. In production back it with Redis
// (ioredis is already a dependency) so cached KPIs/reports are shared across instances and
// survive restarts — swap TtlCache's get/set for Redis GET/SETEX behind the same interface.

export enum Granularity {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export const GRANULARITY_UNIT: Record<Granularity, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  ANNUAL: "year",
};

export enum ReportType {
  REVENUE = "REVENUE",
  BOOKINGS = "BOOKINGS",
  CUSTOMERS = "CUSTOMERS",
  TECHNICIANS = "TECHNICIANS",
  SUBSCRIPTIONS = "SUBSCRIPTIONS",
}

export enum ExportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
  PDF = "PDF",
}

export const CACHE_TTL_MS = 60_000; // dashboard/KPI cache window

/** Minimal TTL cache. Replace with Redis in production (see note above). */
export class TtlCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  get<T>(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }
  set<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
  async wrap<T>(
    key: string,
    ttlMs: number,
    producer: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await producer();
    this.set(key, value, ttlMs);
    return value;
  }
}
