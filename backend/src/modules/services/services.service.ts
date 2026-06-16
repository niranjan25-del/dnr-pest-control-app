// src/modules/services/services.service.ts
//
// Service CRUD + activate/deactivate + search/filter/paginate. Validates referenced
// category/pest-category exist. Price changes (basePrice) are written to AuditLog with the
// old→new values (explicit "track price changes" requirement); create/update are logged.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { uniqueSlug } from 'src/common/utils/slug.util';
import { CreateServiceDto, ServiceFilterDto, UpdateServiceDto } from './dto';
import { SERVICE_SORT_FIELDS, safeSort } from './enums';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto, actorId: string) {
    await this.assertCategory(dto.categoryId);
    if (dto.pestCategoryId) await this.assertPestCategory(dto.pestCategoryId);

    const slug = await uniqueSlug(dto.name, (s) =>
      this.prisma.service.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const service = await this.prisma.service.create({
      data: {
        name: dto.name, slug, description: dto.description,
        estimatedDurationMin: dto.estimatedDurationMin, basePrice: dto.basePrice,
        currency: dto.currency ?? 'INR', categoryId: dto.categoryId,
        pestCategoryId: dto.pestCategoryId, isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Service created: ${service.id} (${slug}) by ${actorId}`);
    return service;
  }

  async update(id: string, dto: UpdateServiceDto, actorId: string) {
    const current = await this.ensure(id);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    if (dto.pestCategoryId) await this.assertPestCategory(dto.pestCategoryId);

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name, description: dto.description, estimatedDurationMin: dto.estimatedDurationMin,
        basePrice: dto.basePrice, currency: dto.currency, categoryId: dto.categoryId,
        pestCategoryId: dto.pestCategoryId, isActive: dto.isActive,
      },
    });

    // Track price changes explicitly.
    if (dto.basePrice !== undefined && Number(current.basePrice) !== Number(dto.basePrice)) {
      await this.auditPrice(actorId, id, Number(current.basePrice), Number(dto.basePrice));
      this.logger.warn(`Service ${id} price ${current.basePrice} → ${dto.basePrice} by ${actorId}`);
    }
    this.logger.log(`Service updated: ${id} by ${actorId}`);
    return service;
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    await this.ensure(id);
    const service = await this.prisma.service.update({ where: { id }, data: { isActive } });
    this.logger.log(`Service ${id} ${isActive ? 'activated' : 'deactivated'} by ${actorId}`);
    return service;
  }

  async remove(id: string, actorId: string) {
    await this.ensure(id);
    await this.prisma.service.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    this.logger.warn(`Service soft-deleted: ${id} by ${actorId}`);
    return { success: true };
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, pestCategory: true },
    });
    if (!service) throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    return service;
  }

  async list(filter: ServiceFilterDto) {
    const where: Prisma.ServiceWhereInput = {
      deletedAt: null,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.pestCategoryId ? { pestCategoryId: filter.pestCategoryId } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const sort = safeSort(filter.sort, SERVICE_SORT_FIELDS, 'createdAt');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where, include: { category: true, pestCategory: true },
        orderBy: { [sort]: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  // ---- helpers ----
  private async ensure(id: string) {
    const s = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    return s;
  }
  private async assertCategory(id: string) {
    const c = await this.prisma.serviceCategory.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!c) throw new BadRequestException({ code: 'CATEGORY_NOT_FOUND', message: 'Service category not found' });
  }
  private async assertPestCategory(id: string) {
    const c = await this.prisma.pestCategory.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!c) throw new BadRequestException({ code: 'PEST_CATEGORY_NOT_FOUND', message: 'Pest category not found' });
  }
  private async auditPrice(actorId: string, id: string, oldPrice: number, newPrice: number) {
    await this.prisma.auditLog.create({
      data: { actorId, action: 'service.price_changed', entityType: 'service', entityId: id,
        metadata: { oldPrice, newPrice } },
    });
  }
}
