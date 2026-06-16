// src/modules/plans/plans.service.ts
//
// Subscription-plan CRUD + activate/deactivate. Slugs generated + unique; soft delete.
// Reads open to any authenticated user; writes are ADMIN (enforced at the controller).

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { uniqueSlug } from 'src/common/utils/slug.util';
import { CreatePlanDto, PlanFilterDto, UpdatePlanDto } from './dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto) {
    const slug = await uniqueSlug(dto.name, (s) =>
      this.prisma.subscriptionPlan.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name, slug, description: dto.description, price: dto.price, currency: dto.currency ?? 'INR',
        billingCycle: dto.billingCycle, visitsPerCycle: dto.visitsPerCycle ?? 1, isActive: dto.isActive ?? true,
      },
    });
    this.logger.log(`Plan created: ${plan.id} (${slug})`);
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.ensure(id);
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name, description: dto.description, price: dto.price, currency: dto.currency,
        billingCycle: dto.billingCycle, visitsPerCycle: dto.visitsPerCycle, isActive: dto.isActive,
      },
    });
    this.logger.log(`Plan updated: ${id}`);
    return plan;
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensure(id);
    return this.prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.subscriptionPlan.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    this.logger.warn(`Plan soft-deleted: ${id}`);
    return { success: true };
  }

  async findOne(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    return plan;
  }

  async list(filter: PlanFilterDto) {
    const where: Prisma.SubscriptionPlanWhereInput = {
      deletedAt: null,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscriptionPlan.findMany({
        where, orderBy: { [filter.sort ?? 'price']: filter.order }, skip: filter.skip, take: filter.limit,
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);
    return paginate(rows, total, filter.page, filter.limit);
  }

  async requireActive(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null, isActive: true } });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found or inactive' });
    return plan;
  }

  private async ensure(id: string) {
    const exists = await this.prisma.subscriptionPlan.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });
  }
}
