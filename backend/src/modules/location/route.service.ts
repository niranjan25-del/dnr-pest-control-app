// src/modules/location/route.service.ts
//
// Durable location history (TechnicianLocation rows) — the source for route playback and
// audits. TechnicianLocation.id is a BigInt; it's serialized to string in responses.

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { TrackingFilterDto } from "./dto";

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a single location fix. Accepts a tx client so it can join a larger transaction. */
  record(
    client: Prisma.TransactionClient | PrismaService,
    params: {
      technicianId: string;
      bookingId?: string | null;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
    },
  ) {
    return client.technicianLocation.create({
      data: {
        technicianId: params.technicianId,
        bookingId: params.bookingId ?? null,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy ?? null,
      },
    });
  }

  async lastKnown(technicianId: string) {
    const row = await this.prisma.technicianLocation.findFirst({
      where: { technicianId },
      orderBy: { recordedAt: "desc" },
    });
    return row ? this.toView(row) : null;
  }

  async history(technicianId: string, filter: TrackingFilterDto) {
    const where: Prisma.TechnicianLocationWhereInput = {
      technicianId,
      ...(filter.bookingId ? { bookingId: filter.bookingId } : {}),
      ...(filter.from || filter.to
        ? {
            recordedAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.technicianLocation.findMany({
        where,
        orderBy: { recordedAt: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.technicianLocation.count({ where }),
    ]);
    return paginate(
      rows.map((r) => this.toView(r)),
      total,
      filter.page,
      filter.limit,
    );
  }

  private toView(r: {
    id: bigint;
    technicianId: string;
    bookingId: string | null;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    accuracy: Prisma.Decimal | null;
    recordedAt: Date;
  }) {
    return {
      id: r.id.toString(),
      technician_id: r.technicianId,
      booking_id: r.bookingId,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      accuracy: r.accuracy != null ? Number(r.accuracy) : null,
      recorded_at: r.recordedAt,
    };
  }
}
