// src/modules/service-packages/service-packages.service.ts
//
// Service Package CRUD + activate/deactivate. A package = ServicePackage + PackageService
// join rows (service + quantity), written in a transaction. Because the schema stores only
// `price`, the response DERIVES:
//   • total_duration_min = Σ(service.estimatedDurationMin × quantity)
//   • base_total          = Σ(service.basePrice × quantity)
//   • discount_percentage = round((1 − price / base_total) × 100), if base_total > 0
// Price changes are audited.

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { uniqueSlug } from "src/common/utils/slug.util";
import {
  CreatePackageDto,
  IncludedServiceDto,
  PackageFilterDto,
  UpdatePackageDto,
} from "./dto";

const PACKAGE_INCLUDE = {
  packageServices: {
    include: {
      service: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          estimatedDurationMin: true,
        },
      },
    },
  },
} satisfies Prisma.ServicePackageInclude;

type PackageWithServices = Prisma.ServicePackageGetPayload<{
  include: typeof PACKAGE_INCLUDE;
}>;

@Injectable()
export class ServicePackagesService {
  private readonly logger = new Logger(ServicePackagesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePackageDto, actorId: string) {
    await this.assertServices(dto.services);
    const slug = await uniqueSlug(dto.name, (s) =>
      this.prisma.servicePackage
        .findUnique({ where: { slug: s } })
        .then(Boolean),
    );
    const created = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.servicePackage.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          price: dto.price,
          currency: dto.currency ?? "INR",
          isActive: dto.isActive ?? true,
        },
      });
      await tx.packageService.createMany({
        data: dto.services.map((s) => ({
          packageId: pkg.id,
          serviceId: s.serviceId,
          quantity: s.quantity,
        })),
      });
      return pkg.id;
    });
    this.logger.log(`Package created: ${created} (${slug}) by ${actorId}`);
    return this.findOne(created);
  }

  async update(id: string, dto: UpdatePackageDto, actorId: string) {
    const current = await this.ensure(id);
    if (dto.services) await this.assertServices(dto.services);

    await this.prisma.$transaction(async (tx) => {
      await tx.servicePackage.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          currency: dto.currency,
          isActive: dto.isActive,
        },
      });
      if (dto.services) {
        await tx.packageService.deleteMany({ where: { packageId: id } });
        await tx.packageService.createMany({
          data: dto.services.map((s) => ({
            packageId: id,
            serviceId: s.serviceId,
            quantity: s.quantity,
          })),
        });
      }
    });

    if (
      dto.price !== undefined &&
      Number(current.price) !== Number(dto.price)
    ) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: "package.price_changed",
          entityType: "service_package",
          entityId: id,
          metadata: {
            oldPrice: Number(current.price),
            newPrice: Number(dto.price),
          },
        },
      });
      this.logger.warn(
        `Package ${id} price ${current.price} → ${dto.price} by ${actorId}`,
      );
    }
    this.logger.log(`Package updated: ${id} by ${actorId}`);
    return this.findOne(id);
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    await this.ensure(id);
    await this.prisma.servicePackage.update({
      where: { id },
      data: { isActive },
    });
    this.logger.log(
      `Package ${id} ${isActive ? "activated" : "deactivated"} by ${actorId}`,
    );
    return this.findOne(id);
  }

  async remove(id: string, actorId: string) {
    await this.ensure(id);
    await this.prisma.servicePackage.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    this.logger.warn(`Package soft-deleted: ${id} by ${actorId}`);
    return { success: true };
  }

  async findOne(id: string) {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id, deletedAt: null },
      include: PACKAGE_INCLUDE,
    });
    if (!pkg)
      throw new NotFoundException({
        code: "PACKAGE_NOT_FOUND",
        message: "Package not found",
      });
    return this.toResponse(pkg);
  }

  async list(filter: PackageFilterDto) {
    const where: Prisma.ServicePackageWhereInput = {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.servicePackage.findMany({
        where,
        include: PACKAGE_INCLUDE,
        orderBy: { [filter.sort ?? "createdAt"]: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.servicePackage.count({ where }),
    ]);
    return paginate(
      rows.map((r) => this.toResponse(r)),
      total,
      filter.page,
      filter.limit,
    );
  }

  // ---- helpers ----
  private async ensure(id: string) {
    const p = await this.prisma.servicePackage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!p)
      throw new NotFoundException({
        code: "PACKAGE_NOT_FOUND",
        message: "Package not found",
      });
    return p;
  }

  private async assertServices(services: IncludedServiceDto[]) {
    const ids = [...new Set(services.map((s) => s.serviceId))];
    const found = await this.prisma.service.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (found !== ids.length) {
      throw new BadRequestException({
        code: "SERVICE_NOT_FOUND",
        message: "One or more included services do not exist",
      });
    }
  }

  // Compose the response with derived discount % and total duration.
  private toResponse(pkg: PackageWithServices) {
    const baseTotal = pkg.packageServices.reduce(
      (sum, ps) => sum + Number(ps.service.basePrice) * ps.quantity,
      0,
    );
    const totalDuration = pkg.packageServices.reduce(
      (sum, ps) => sum + ps.service.estimatedDurationMin * ps.quantity,
      0,
    );
    const price = Number(pkg.price);
    const discountPercentage =
      baseTotal > 0
        ? Math.max(0, Math.round((1 - price / baseTotal) * 100))
        : 0;
    return {
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      price,
      currency: pkg.currency,
      is_active: pkg.isActive,
      // Derived (not stored):
      base_total: Number(baseTotal.toFixed(2)),
      discount_percentage: discountPercentage,
      total_duration_min: totalDuration,
      included_services: pkg.packageServices.map((ps) => ({
        service_id: ps.service.id,
        name: ps.service.name,
        quantity: ps.quantity,
        base_price: Number(ps.service.basePrice),
        duration_min: ps.service.estimatedDurationMin,
      })),
      created_at: pkg.createdAt,
      updated_at: pkg.updatedAt,
    };
  }
}
