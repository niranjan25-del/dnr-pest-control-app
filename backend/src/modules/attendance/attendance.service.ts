// src/modules/attendance/attendance.service.ts
//
// Technician punch-in / punch-out. Multiple sessions per day allowed (e.g. lunch breaks).
// Each punch-in opens a new row; punch-out closes the latest open session.
// Date is stored as UTC midnight for grouping purposes.

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";

function todayUtc(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export interface DutyLogRow {
  id: string;
  technician_id: string;
  full_name: string;
  date: Date;
  punched_in_at: Date;
  punched_out_at: Date | null;
  duration_minutes: number | null;
  note: string | null;
}

const INCLUDE = {
  technician: { select: { user: { select: { fullName: true } } } },
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async resolveTechProfile(userId: string) {
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile)
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: "Technician profile not found",
      });
    return profile;
  }

  private toRow(log: {
    id: string;
    technicianId: string;
    date: Date;
    punchedInAt: Date;
    punchedOutAt: Date | null;
    note: string | null;
    technician: { user: { fullName: string } };
  }): DutyLogRow {
    const durMin = log.punchedOutAt
      ? Math.round(
          (log.punchedOutAt.getTime() - log.punchedInAt.getTime()) / 60_000,
        )
      : null;
    return {
      id: log.id,
      technician_id: log.technicianId,
      full_name: log.technician.user.fullName,
      date: log.date,
      punched_in_at: log.punchedInAt,
      punched_out_at: log.punchedOutAt,
      duration_minutes: durMin,
      note: log.note,
    };
  }

  // ── technician endpoints ─────────────────────────────────────────────────────

  async punchIn(actor: AuthenticatedUser, note?: string): Promise<DutyLogRow> {
    const profile = await this.resolveTechProfile(actor.id);
    const date = todayUtc();

    // Prevent double punch-in: must close current open session first
    const openSession = await this.prisma.technicianDutyLog.findFirst({
      where: { technicianId: profile.id, date, punchedOutAt: null },
    });
    if (openSession) {
      throw new BadRequestException({
        code: "SESSION_OPEN",
        message: "Please punch out before punching in again",
      });
    }

    const [log] = await this.prisma.$transaction([
      this.prisma.technicianDutyLog.create({
        data: {
          technicianId: profile.id,
          date,
          punchedInAt: new Date(),
          note: note ?? null,
        },
        include: INCLUDE,
      }),
      this.prisma.technicianProfile.update({
        where: { id: profile.id },
        data: { isAvailable: true },
      }),
    ]);
    return this.toRow(log);
  }

  async punchOut(actor: AuthenticatedUser, note?: string): Promise<DutyLogRow> {
    const profile = await this.resolveTechProfile(actor.id);
    const date = todayUtc();

    // Find the latest open session (no punchedOutAt)
    const openSession = await this.prisma.technicianDutyLog.findFirst({
      where: { technicianId: profile.id, date, punchedOutAt: null },
      orderBy: { punchedInAt: "desc" },
    });
    if (!openSession) {
      throw new BadRequestException({
        code: "NO_OPEN_SESSION",
        message: "You are not currently punched in",
      });
    }

    const [log] = await this.prisma.$transaction([
      this.prisma.technicianDutyLog.update({
        where: { id: openSession.id },
        data: { punchedOutAt: new Date(), ...(note ? { note } : {}) },
        include: INCLUDE,
      }),
      this.prisma.technicianProfile.update({
        where: { id: profile.id },
        data: { isAvailable: false },
      }),
    ]);
    return this.toRow(log);
  }

  async todayStatus(actor: AuthenticatedUser) {
    const profile = await this.resolveTechProfile(actor.id);
    const date = todayUtc();

    // Latest session determines current status
    const latest = await this.prisma.technicianDutyLog.findFirst({
      where: { technicianId: profile.id, date },
      orderBy: { punchedInAt: "desc" },
      include: INCLUDE,
    });

    // All sessions today for the card display
    const sessions = await this.prisma.technicianDutyLog.findMany({
      where: { technicianId: profile.id, date },
      orderBy: { punchedInAt: "asc" },
      include: INCLUDE,
    });

    if (!latest) return { status: "NOT_PUNCHED_IN", log: null, sessions: [] };
    const status = latest.punchedOutAt ? "PUNCHED_OUT" : "ON_DUTY";
    return {
      status,
      log: this.toRow(latest),
      sessions: sessions.map((s) => this.toRow(s)),
    };
  }

  // ── admin endpoints ──────────────────────────────────────────────────────────

  async adminList(filter: {
    date?: string;
    from?: string;
    to?: string;
    technicianId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: DutyLogRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(200, filter.limit ?? 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filter.userId) {
      where["technician"] = { userId: filter.userId };
    } else if (filter.technicianId) {
      where["technicianId"] = filter.technicianId;
    }

    if (filter.date) {
      const d = new Date(filter.date);
      where["date"] = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      );
    } else if (filter.from || filter.to) {
      const dateFilter: Record<string, Date> = {};
      if (filter.from) {
        const f = new Date(filter.from);
        dateFilter["gte"] = new Date(
          Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()),
        );
      }
      if (filter.to) {
        const t = new Date(filter.to);
        dateFilter["lte"] = new Date(
          Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()),
        );
      }
      where["date"] = dateFilter;
    } else if (!filter.userId) {
      // Default to today only when not viewing a specific technician's full history
      where["date"] = todayUtc();
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.technicianDutyLog.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: "desc" }, { punchedInAt: "asc" }],
        skip,
        take: limit,
      }),
      this.prisma.technicianDutyLog.count({ where }),
    ]);

    return { data: rows.map((r) => this.toRow(r)), total, page, limit };
  }
}
