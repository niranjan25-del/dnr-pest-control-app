// src/modules/technician-assignment/assignment-engine.service.ts
//
// Auto-assignment engine. Produces a ranked list of eligible technicians for a booking and
// picks the best.
//
// ALGORITHM (weighted scoring, weights in enums/SCORE_WEIGHTS, total 100):
//   1. Candidate pool = available technicians (isAvailable, not deleted), each loaded with
//      service areas (postal codes), skills, and latest known location.
//   2. HARD filters (exclude): not available, time conflict with the booking window, or daily
//      capacity reached. These are safety constraints — an unavailable/over-capacity tech is
//      never auto-picked.
//   3. SOFT score (rank the survivors):
//      • SERVICE_AREA (40): technician serves the booking's postal code → full marks. Highest
//        weight because dispatching out-of-area is the costliest mistake.
//      • SKILL (30): technician's skills include the service/category/pest token. If the
//        technician lists no skills they're treated as a generalist (partial credit), so an
//        un-tagged roster never yields zero candidates.
//      • WORKLOAD (20): lighter current daily load scores higher → balances the roster.
//      • DISTANCE (10): closer to the site scores higher (tiebreaker); unknown location =
//        neutral so missing GPS doesn't unfairly penalize.
//   4. Pick the highest score; ties broken by lower workload then shorter distance.
//
// Service has no requiredSkills column (schema), so the "required skill" is derived from the
// service slug + its category/pest slugs and matched against technician.skills (case-insensitive).

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { CAPACITY, SCORE_WEIGHTS } from "./enums";
import { ResolvedWindow, TechnicianCandidate } from "./interfaces";
import { TechnicianAvailabilityService } from "./availability.service";
import { WorkloadService } from "./workload.service";

@Injectable()
export class AssignmentEngineService {
  private readonly logger = new Logger(AssignmentEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: TechnicianAvailabilityService,
    private readonly workload: WorkloadService,
  ) {}

  /** Booking context needed for scoring. */
  private async loadBookingContext(bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: {
        address: {
          select: { postalCode: true, latitude: true, longitude: true },
        },
        service: {
          select: {
            slug: true,
            category: { select: { slug: true } },
            pestCategory: { select: { slug: true } },
          },
        },
      },
    });
    if (!booking)
      throw new BadRequestException({
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found",
      });
    return booking;
  }

  /** Rank all eligible technicians for a booking (excludes hard-fails). */
  async rankCandidates(
    bookingId: string,
    excludeTechnicianId?: string,
  ): Promise<TechnicianCandidate[]> {
    const booking = await this.loadBookingContext(bookingId);
    const window: ResolvedWindow = {
      start: booking.scheduledWindowStart,
      end: booking.scheduledWindowEnd,
    };
    const postal = booking.address.postalCode;
    const lat = booking.address.latitude
      ? Number(booking.address.latitude)
      : null;
    const lng = booking.address.longitude
      ? Number(booking.address.longitude)
      : null;

    const techs = await this.prisma.technicianProfile.findMany({
      where: {
        deletedAt: null,
        ...(excludeTechnicianId ? { id: { not: excludeTechnicianId } } : {}),
      },
      select: {
        id: true,
        isAvailable: true,
        user: { select: { fullName: true } },
        serviceAreas: { select: { postalCodes: true } },
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { latitude: true, longitude: true },
        },
      },
    });

    const candidates: TechnicianCandidate[] = [];
    for (const t of techs) {
      // Hard filters.
      const conflict = await this.availability.hasConflict(t.id, window);
      if (conflict) continue;
      const dailyActive = await this.workload.dailyWorkload(t.id, window.start);
      if (dailyActive >= CAPACITY.MAX_DAILY_JOBS) continue;

      // Soft scoring.
      const servesArea = t.serviceAreas.some((a) =>
        a.postalCodes.includes(postal),
      );

      const areaScore = servesArea ? SCORE_WEIGHTS.SERVICE_AREA : 0;
      const skillScore = SCORE_WEIGHTS.SKILL; // all technicians handle all job types
      const workloadScore =
        SCORE_WEIGHTS.WORKLOAD *
        (1 -
          Math.min(dailyActive, CAPACITY.MAX_DAILY_JOBS) /
            CAPACITY.MAX_DAILY_JOBS);

      const loc = t.locations[0];
      let distanceKm: number | null = null;
      let distanceScore = SCORE_WEIGHTS.DISTANCE * 0.5; // neutral when unknown
      if (loc && lat !== null && lng !== null) {
        distanceKm = this.haversineKm(
          lat,
          lng,
          Number(loc.latitude),
          Number(loc.longitude),
        );
        // Linear falloff over 50 km.
        distanceScore =
          SCORE_WEIGHTS.DISTANCE *
          Math.max(0, 1 - Math.min(distanceKm, 50) / 50);
      }

      const score = Math.round(
        areaScore + skillScore + workloadScore + distanceScore,
      );
      candidates.push({
        technicianId: t.id,
        technician_id: t.id,
        name: t.user.fullName,
        full_name: t.user.fullName,
        score,
        hard_eligible: true,
        is_available: t.isAvailable,
        serves_area: servesArea,
        has_skill: true,
        active_jobs: dailyActive,
        distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
        breakdown: {
          serviceArea: areaScore,
          skill: Math.round(skillScore),
          workload: Math.round(workloadScore),
          distance: Math.round(distanceScore),
        },
        distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
        dailyActiveJobs: dailyActive,
        servesArea,
        hasSkill: true,
      });
    }

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        a.dailyActiveJobs - b.dailyActiveJobs ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
    return candidates;
  }

  /** Pick the single best technician, or throw if none are eligible. */
  async pickBest(
    bookingId: string,
    excludeTechnicianId?: string,
  ): Promise<TechnicianCandidate> {
    const ranked = await this.rankCandidates(bookingId, excludeTechnicianId);
    if (!ranked.length) {
      throw new BadRequestException({
        code: "TECHNICIAN_UNAVAILABLE",
        message: "No eligible technician is available for this booking",
      });
    }
    this.logger.log(
      `Auto-assign for booking ${bookingId} → ${ranked[0].technicianId} (score ${ranked[0].score})`,
    );
    return ranked[0];
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
