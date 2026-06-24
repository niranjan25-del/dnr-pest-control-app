// src/modules/services/service-categories.service.ts
//
// Service Category CRUD (e.g. Residential, Commercial, Termite, Rodent). Slugs are generated
// from the name and kept unique. Delete is soft (deletedAt + isActive=false). Admin-only
// writes are enforced at the controller; reads are open to any authenticated user.

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { uniqueSlug } from "src/common/utils/slug.util";
import {
  CategoryFilterDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from "./dto";
import { CATEGORY_SORT_FIELDS, safeSort } from "./enums";

@Injectable()
export class ServiceCategoriesService {
  private readonly logger = new Logger(ServiceCategoriesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceCategoryDto) {
    const slug = await uniqueSlug(dto.name, (s) =>
      this.prisma.serviceCategory
        .findUnique({ where: { slug: s } })
        .then(Boolean),
    );
    const category = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        iconUrl: dto.iconUrl,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Service category created: ${category.id} (${slug})`);
    return category;
  }

  async update(id: string, dto: UpdateServiceCategoryDto) {
    await this.ensure(id);
    const category = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    this.logger.log(`Service category updated: ${id}`);
    return category;
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.serviceCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    this.logger.warn(`Service category soft-deleted: ${id}`);
    return { success: true };
  }

  async findOne(id: string) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id, deletedAt: null },
      include: { services: { where: { deletedAt: null } } },
    });
    if (!category)
      throw new NotFoundException({
        code: "CATEGORY_NOT_FOUND",
        message: "Service category not found",
      });
    return category;
  }

  async list(filter: CategoryFilterDto) {
    const where: Prisma.ServiceCategoryWhereInput = {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? { name: { contains: filter.search, mode: "insensitive" } }
        : {}),
    };
    const sort = safeSort(filter.sort, CATEGORY_SORT_FIELDS, "sortOrder");
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: { [sort]: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  private async ensure(id: string) {
    const exists = await this.prisma.serviceCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists)
      throw new NotFoundException({
        code: "CATEGORY_NOT_FOUND",
        message: "Service category not found",
      });
  }
}
