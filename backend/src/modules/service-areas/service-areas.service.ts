// src/modules/service-areas/service-areas.service.ts
//
// Service-area CRUD + coverage checking. Coverage is POSTAL-CODE based (the schema's model):
// an address is covered if its postal code appears in any active area. activate/deactivate
// toggle `deletedAt` (the schema has no separate isActive) — a deactivated/deleted area
// provides no coverage; activate restores it. Documented limitation; see dto for the delta.

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import {
  CreateServiceAreaDto,
  ServiceAreaFilterDto,
  UpdateServiceAreaDto,
} from "./dto";

export interface CoverageResult {
  postal_code: string;
  covered: boolean;
  areas: { id: string; name: string }[];
}

@Injectable()
export class ServiceAreasService {
  private readonly logger = new Logger(ServiceAreasService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceAreaDto) {
    const area = await this.prisma.serviceArea.create({
      data: {
        name: dto.name,
        postalCodes: dto.postalCodes,
        technicianId: dto.technicianId,
      },
    });
    this.logger.log(`Service area created: ${area.id}`);
    return area;
  }

  async update(id: string, dto: UpdateServiceAreaDto) {
    await this.ensure(id);
    const area = await this.prisma.serviceArea.update({
      where: { id },
      data: {
        name: dto.name,
        postalCodes: dto.postalCodes,
        technicianId: dto.technicianId,
      },
    });
    this.logger.log(`Service area updated: ${id}`);
    return area;
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.serviceArea.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.warn(`Service area deleted: ${id}`);
    return { success: true };
  }

  // activate/deactivate share the deletedAt mechanism (no separate isActive column).
  async setActive(id: string, active: boolean) {
    const area = await this.prisma.serviceArea.findUnique({ where: { id } });
    if (!area)
      throw new NotFoundException({
        code: "SERVICE_AREA_NOT_FOUND",
        message: "Service area not found",
      });
    const updated = await this.prisma.serviceArea.update({
      where: { id },
      data: { deletedAt: active ? null : new Date() },
    });
    this.logger.log(
      `Service area ${id} ${active ? "activated" : "deactivated"}`,
    );
    return updated;
  }

  async findOne(id: string) {
    const area = await this.prisma.serviceArea.findFirst({
      where: { id, deletedAt: null },
    });
    if (!area)
      throw new NotFoundException({
        code: "SERVICE_AREA_NOT_FOUND",
        message: "Service area not found",
      });
    return area;
  }

  async list(filter: ServiceAreaFilterDto) {
    const where: Prisma.ServiceAreaWhereInput = {
      deletedAt: null,
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceArea.findMany({
        where,
        orderBy: { [filter.sort ?? "name"]: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.serviceArea.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  /** Coverage check — is this postal code served by any active area? */
  async checkCoverage(postalCode: string): Promise<CoverageResult> {
    const normalized = postalCode.trim();
    const areas = await this.prisma.serviceArea.findMany({
      where: { deletedAt: null, postalCodes: { has: normalized } },
      select: { id: true, name: true },
    });
    return { postal_code: normalized, covered: areas.length > 0, areas };
  }

  private async ensure(id: string) {
    const exists = await this.prisma.serviceArea.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists)
      throw new NotFoundException({
        code: "SERVICE_AREA_NOT_FOUND",
        message: "Service area not found",
      });
  }
}
