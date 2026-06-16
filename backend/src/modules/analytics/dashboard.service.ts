// src/modules/analytics/dashboard.service.ts
//
// Executive dashboard KPIs, cached for a short window (TtlCache; swap for Redis in production).
// Each KPI is a focused count/aggregate so the dashboard stays cheap even before caching.

import { Injectable } from '@nestjs/common';
import { BookingStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AnalyticsService } from './analytics.service';
import { CACHE_TTL_MS, TtlCache } from './enums';
import { DashboardKpis } from './interfaces';

@Injectable()
export class DashboardService {
  private readonly cache = new TtlCache();

  constructor(private readonly prisma: PrismaService, private readonly analytics: AnalyticsService) {}

  async kpis(): Promise<DashboardKpis> {
    return this.cache.wrap('dashboard:kpis', CACHE_TTL_MS, async () => {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const activeSince = new Date(Date.now() - 30 * 86400_000);

      const [
        totalRevenue, monthlyRevenue, totalCustomers, activeCustomers,
        totalBookings, completedBookings, activeTechnicians, activeSubscriptions,
      ] = await Promise.all([
        this.analytics.revenueNet(new Date(0), new Date()),
        this.analytics.revenueNet(monthStart, new Date()),
        this.prisma.customerProfile.count({ where: { deletedAt: null } }),
        this.prisma.customerProfile.count({ where: { deletedAt: null, bookings: { some: { createdAt: { gte: activeSince } } } } }),
        this.prisma.booking.count({ where: { deletedAt: null } }),
        this.prisma.booking.count({ where: { deletedAt: null, status: BookingStatus.COMPLETED } }),
        this.prisma.technicianProfile.count({ where: { deletedAt: null, isAvailable: true } }),
        this.prisma.subscription.count({ where: { deletedAt: null, status: SubscriptionStatus.ACTIVE } }),
      ]);

      return {
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_bookings: totalBookings,
        completed_bookings: completedBookings,
        active_technicians: activeTechnicians,
        active_subscriptions: activeSubscriptions,
        generated_at: new Date(),
      };
    });
  }
}
