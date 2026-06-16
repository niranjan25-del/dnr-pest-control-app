// src/modules/pest-categories/pest-categories.service.ts
//
// Pest Category CRUD. Slugs generated + unique; soft delete (deletedAt + isActive=false).

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { uniqueSlug } from 'src/common/utils/slug.util';
import { CreatePestCategoryDto, PestCategoryFilterDto, UpdatePestCategoryDto } from './dto';

@Injectable()
export class PestCategoriesService {
  private readonly logger = new Logger(PestCategoriesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePestCategoryDto) {
    const slug = await uniqueSlug(dto.name, (s) =>
      this.prisma.pestCategory.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const category = await this.prisma.pestCategory.create({
      data: { name: dto.name, slug, description: dto.description, iconUrl: dto.iconUrl, isActive: dto.isActive ?? true },
    });
    this.logger.log(`Pest category created: ${category.id} (${slug})`);
    return category;
  }

  async update(id: string, dto: UpdatePestCategoryDto) {
    await this.ensure(id);
    const category = await this.prisma.pestCategory.update({
      where: { id },
      data: { name: dto.name, description: dto.description, iconUrl: dto.iconUrl, isActive: dto.isActive },
    });
    this.logger.log(`Pest category updated: ${id}`);
    return category;
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.pestCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    this.logger.warn(`Pest category soft-deleted: ${id}`);
    return { success: true };
  }

  async findOne(id: string) {
    const category = await this.prisma.pestCategory.findFirst({ where: { id, deletedAt: null } });
    if (!category) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Pest category not found' });
    return category;
  }

  async list(filter: PestCategoryFilterDto) {
    const where: Prisma.PestCategoryWhereInput = {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pestCategory.findMany({
        where, orderBy: { [filter.sort ?? 'name']: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.pestCategory.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  private async ensure(id: string) {
    const exists = await this.prisma.pestCategory.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Pest category not found' });
  }
}
