// src/modules/technician-assignment/workload.service.ts
//
// Workload math for capacity validation + the dispatch dashboard. "Active workload" = count
// of ASSIGNED/ACCEPTED assignments whose booking falls in the period. Daily/weekly windows
// are computed from a reference date.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ACTIVE_ASSIGNMENT_STATUSES, CAPACITY } from './enums';
import { WorkloadSummary } from './interfaces';

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  private dayBounds(ref: Date) {
    const start = new Date(ref); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private weekBounds(ref: Date) {
    const start = new Date(ref); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // week starts Sunday
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start, end };
  }

  private countWhere(technicianId: string, start: Date, end: Date): Prisma.TechnicianAssignmentWhereInput {
    return {
      technicianId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      booking: { deletedAt: null, scheduledWindowStart: { gte: start, lt: end } },
    };
  }

  dailyWorkload(technicianId: string, ref = new Date()): Promise<number> {
    const { start, end } = this.dayBounds(ref);
    return this.prisma.technicianAssignment.count({ where: this.countWhere(technicianId, start, end) });
  }

  weeklyWorkload(technicianId: string, ref = new Date()): Promise<number> {
    const { start, end } = this.weekBounds(ref);
    return this.prisma.technicianAssignment.count({ where: this.countWhere(technicianId, start, end) });
  }

  async hasDailyCapacity(technicianId: string, ref = new Date()): Promise<boolean> {
    return (await this.dailyWorkload(technicianId, ref)) < CAPACITY.MAX_DAILY_JOBS;
  }

  /** Per-technician workload summaries for the dispatch dashboard. */
  async summaries(ref = new Date()): Promise<WorkloadSummary[]> {
    const techs = await this.prisma.technicianProfile.findMany({
      where: { deletedAt: null },
      select: { id: true, isAvailable: true, user: { select: { fullName: true } } },
    });
    return Promise.all(
      techs.map(async (t) => {
        const [dailyActive, weeklyActive] = await Promise.all([
          this.dailyWorkload(t.id, ref),
          this.weeklyWorkload(t.id, ref),
        ]);
        return {
          technicianId: t.id,
          name: t.user.fullName,
          isAvailable: t.isAvailable,
          dailyActive,
          weeklyActive,
          dailyCapacityRemaining: Math.max(0, CAPACITY.MAX_DAILY_JOBS - dailyActive),
        };
      }),
    );
  }
}
