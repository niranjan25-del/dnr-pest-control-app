// src/modules/technician-assignment/availability.service.ts
//
// Hard availability guards used before any assignment is created/reassigned:
//   • technician is flagged available (isAvailable)
//   • no time conflict with an existing ASSIGNED/ACCEPTED booking window
//   • daily capacity not exceeded
// Throws standardized errors. (Time-off is schema-pending — would add a TimeOff model.)

import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ACTIVE_ASSIGNMENT_STATUSES } from './enums';
import { WorkloadService } from './workload.service';
import { ResolvedWindow } from './interfaces';

@Injectable()
export class TechnicianAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workload: WorkloadService,
  ) {}

  async assertAvailable(technicianId: string, window: ResolvedWindow, excludeBookingId?: string): Promise<void> {
    const profile = await this.prisma.technicianProfile.findFirst({
      where: { id: technicianId, deletedAt: null },
      select: { id: true, isAvailable: true },
    });
    if (!profile) throw new BadRequestException({ code: 'TECHNICIAN_NOT_FOUND', message: 'Technician not found' });
    if (!profile.isAvailable) {
      throw new ConflictException({ code: 'TECHNICIAN_UNAVAILABLE', message: 'Technician is not available' });
    }

    if (await this.hasConflict(technicianId, window, excludeBookingId)) {
      throw new ConflictException({
        code: 'ASSIGNMENT_CONFLICT',
        message: 'Technician already has a job overlapping this time window',
      });
    }

    if (!(await this.workload.hasDailyCapacity(technicianId, window.start))) {
      throw new ConflictException({
        code: 'CAPACITY_EXCEEDED',
        message: 'Technician has reached the daily job limit',
      });
    }
  }

  async hasConflict(technicianId: string, window: ResolvedWindow, excludeBookingId?: string): Promise<boolean> {
    const count = await this.prisma.technicianAssignment.count({
      where: {
        technicianId,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        booking: {
          deletedAt: null,
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          // overlap: existing.start < new.end AND existing.end > new.start
          scheduledWindowStart: { lt: window.end },
          scheduledWindowEnd: { gt: window.start },
        },
      },
    });
    return count > 0;
  }
}
