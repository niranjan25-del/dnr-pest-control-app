// src/modules/analytics/analytics.service.ts
//
// Domain analytics aggregations. Single-table time-series use $queryRaw with date_trunc
// (granularity is whitelisted, so the raw token is safe; dates/statuses are parameterized).
// Multi-hop figures (revenue by service/technician) use typed Prisma queries + in-memory
// aggregation — correct and migration-safe; for large data, see the optimization notes.
//
// Net revenue = amount − refunded_amount over SUCCEEDED / PARTIALLY_REFUNDED / REFUNDED
// payments (a fully refunded payment nets to 0).

import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus, PaymentStatus, Prisma, ReviewStatus, SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { UserRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { GRANULARITY_UNIT, Granularity } from './enums';
import { LabelledValue, TimeSeriesPoint } from './interfaces';

const REVENUE_STATUSES = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- shared ----------------
  range(from?: string, to?: string): { from: Date; to: Date } {
    const toD = to ? new Date(to) : new Date();
    const fromD = from ? new Date(from) : new Date(toD.getTime() - 30 * 86400_000);
    return { from: fromD, to: toD };
  }

  // ---------------- revenue ----------------
  async revenueNet(from: Date, to: Date): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
      _sum: { amount: true, refundedAmount: true },
    });
    return Number(agg._sum.amount ?? 0) - Number(agg._sum.refundedAmount ?? 0);
  }

  async revenueSeries(from: Date, to: Date, granularity: Granularity): Promise<TimeSeriesPoint[]> {
    const unit = GRANULARITY_UNIT[granularity];
    const rows = await this.prisma.$queryRaw<{ bucket: Date; net: number }[]>(Prisma.sql`
      SELECT date_trunc(${Prisma.raw(`'${unit}'`)}, created_at) AS bucket,
             SUM(amount - refunded_amount)::float AS net
      FROM payments
      WHERE status::text IN (${Prisma.join(REVENUE_STATUSES)}) AND created_at >= ${from} AND created_at <= ${to}
      GROUP BY bucket ORDER BY bucket`);
    return rows.map((r) => ({ bucket: r.bucket.toISOString().slice(0, 10), value: Number(r.net) }));
  }

  async revenueByService(from: Date, to: Date): Promise<LabelledValue[]> {
    const payments = await this.prisma.payment.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
      select: { amount: true, refundedAmount: true, invoice: { select: { booking: { select: { service: { select: { name: true } } } } } } },
    });
    return this.groupNet(payments, (p) => p.invoice?.booking?.service?.name ?? 'Unattributed');
  }

  async revenueByTechnician(from: Date, to: Date): Promise<LabelledValue[]> {
    const payments = await this.prisma.payment.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lte: to } },
      select: {
        amount: true, refundedAmount: true,
        invoice: { select: { booking: { select: { assignments: { orderBy: { createdAt: 'desc' }, take: 1, select: { technician: { select: { user: { select: { fullName: true } } } } } } } } } },
      },
    });
    return this.groupNet(payments, (p) => p.invoice?.booking?.assignments?.[0]?.technician?.user?.fullName ?? 'Unassigned');
  }

  private groupNet<T extends { amount: Prisma.Decimal; refundedAmount: Prisma.Decimal }>(rows: T[], keyFn: (r: T) => string): LabelledValue[] {
    const map = new Map<string, { value: number; count: number }>();
    for (const r of rows) {
      const key = keyFn(r);
      const net = Number(r.amount) - Number(r.refundedAmount);
      const cur = map.get(key) ?? { value: 0, count: 0 };
      cur.value += net; cur.count++;
      map.set(key, cur);
    }
    return [...map.entries()].map(([label, v]) => ({ label, value: Math.round(v.value * 100) / 100, count: v.count })).sort((a, b) => b.value - a.value);
  }

  async revenue(from: Date, to: Date, granularity: Granularity = Granularity.DAILY) {
    const [net, series, byService, byTechnician] = await Promise.all([
      this.revenueNet(from, to), this.revenueSeries(from, to, granularity), this.revenueByService(from, to), this.revenueByTechnician(from, to),
    ]);
    return { net_revenue: net, series, by_service: byService, by_technician: byTechnician };
  }

  // ---------------- bookings ----------------
  async bookings(from: Date, to: Date, granularity: Granularity = Granularity.DAILY) {
    const where: Prisma.BookingWhereInput = { deletedAt: null, createdAt: { gte: from, lte: to } };
    const [total, byStatus, series, reschedules] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({ by: ['status'], where, _count: true }),
      this.bucketSeries('bookings', from, to, granularity),
      this.prisma.bookingStatusHistory.count({ where: { note: { contains: 'reschedul', mode: 'insensitive' }, createdAt: { gte: from, lte: to } } }),
    ]);
    const count = (s: BookingStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
    const completed = count(BookingStatus.COMPLETED);
    const cancelled = count(BookingStatus.CANCELLED) + count(BookingStatus.NO_SHOW);
    return {
      total,
      by_status: byStatus.map((b) => ({ label: b.status, value: b._count })),
      completion_rate: total ? +(completed / total).toFixed(4) : 0,
      cancellation_rate: total ? +(cancelled / total).toFixed(4) : 0,
      reschedule_rate: total ? +(reschedules / total).toFixed(4) : 0, // ⚠ inferred from status-history notes
      trends: series,
    };
  }

  // ---------------- customers ----------------
  async customers(from: Date, to: Date) {
    const [total, newCustomers, activeCustomers, repeat] = await Promise.all([
      this.prisma.customerProfile.count({ where: { deletedAt: null } }),
      this.prisma.customerProfile.count({ where: { deletedAt: null, createdAt: { gte: from, lte: to } } }),
      this.prisma.customerProfile.count({ where: { deletedAt: null, bookings: { some: { createdAt: { gte: from, lte: to } } } } }),
      this.prisma.customerProfile.count({ where: { deletedAt: null, bookings: { some: { status: BookingStatus.COMPLETED } } } }),
    ]);
    const netAll = await this.revenueNet(new Date(0), new Date());
    const clv = total ? Math.round((netAll / total) * 100) / 100 : 0;
    return {
      total_customers: total,
      new_customers: newCustomers,
      active_customers: activeCustomers,
      repeat_customers: repeat,
      retention_rate: total ? +(activeCustomers / total).toFixed(4) : 0, // ⚠ approximation (active/total)
      avg_lifetime_value: clv,
    };
  }

  // ---------------- technicians ----------------
  async technicians(actor: AuthenticatedUser, from: Date, to: Date) {
    const where: Prisma.TechnicianProfileWhereInput = { deletedAt: null };
    if (actor.role === UserRole.TECHNICIAN) {
      const self = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!self) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'No technician profile' });
      where.id = self.id;
    }
    const techs = await this.prisma.technicianProfile.findMany({
      where, select: { id: true, jobsCompleted: true, ratingAverage: true, user: { select: { fullName: true } } },
    });
    const revByTech = await this.revenueByTechnician(from, to);
    const revMap = new Map(revByTech.map((r) => [r.label, r.value]));
    const rows = await Promise.all(techs.map(async (t) => {
      const completedInRange = await this.prisma.booking.count({
        where: { status: BookingStatus.COMPLETED, deletedAt: null, updatedAt: { gte: from, lte: to }, assignments: { some: { technicianId: t.id } } },
      });
      return {
        technician_id: t.id,
        name: t.user.fullName,
        jobs_completed_total: t.jobsCompleted,
        jobs_completed_in_range: completedInRange,
        average_rating: Number(t.ratingAverage),
        revenue_generated: revMap.get(t.user.fullName) ?? 0,
        // ⚠ utilization is an approximation: completed jobs over the period's working days (8h/job, 8 jobs/day cap).
        utilization_rate: this.estimateUtilization(completedInRange, from, to),
      };
    }));
    return { technicians: rows };
  }

  private estimateUtilization(jobs: number, from: Date, to: Date): number {
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400_000));
    const capacity = days * 8; // assume up to 8 jobs/working-day
    return +Math.min(1, jobs / capacity).toFixed(4);
  }

  // ---------------- services ----------------
  async services(from: Date, to: Date, granularity: Granularity = Granularity.MONTHLY) {
    const popular = await this.prisma.booking.groupBy({
      by: ['serviceId'], where: { deletedAt: null, createdAt: { gte: from, lte: to }, serviceId: { not: null } }, _count: true,
    });
    const ids = popular.map((p) => p.serviceId!).filter(Boolean);
    const names = await this.prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameMap = new Map(names.map((n) => [n.id, n.name]));
    return {
      most_popular: popular.map((p) => ({ label: nameMap.get(p.serviceId!) ?? 'Unknown', value: p._count })).sort((a, b) => b.value - a.value),
      revenue_by_service: await this.revenueByService(from, to),
      growth: await this.bucketSeries('bookings', from, to, granularity),
    };
  }

  // ---------------- subscriptions ----------------
  async subscriptions(from: Date, to: Date) {
    const [active, paused, cancelledInRange, plans] = await Promise.all([
      this.prisma.subscription.count({ where: { deletedAt: null, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { deletedAt: null, status: SubscriptionStatus.PAUSED } }),
      this.prisma.subscription.count({ where: { deletedAt: null, status: SubscriptionStatus.CANCELLED, cancelledAt: { gte: from, lte: to } } }),
      this.prisma.subscription.findMany({ where: { deletedAt: null, status: SubscriptionStatus.ACTIVE }, select: { plan: { select: { price: true } } } }),
    ]);
    const mrr = plans.reduce((s, x) => s + Number(x.plan.price), 0); // ⚠ gross of active plan prices (not cycle-normalized)
    const base = active + cancelledInRange;
    return {
      active_subscriptions: active,
      paused_subscriptions: paused,
      cancelled_in_range: cancelledInRange,
      churn_rate: base ? +(cancelledInRange / base).toFixed(4) : 0,       // ⚠ approximation
      renewal_rate: base ? +(active / base).toFixed(4) : 0,               // ⚠ approximation
      subscription_revenue: Math.round(mrr * 100) / 100,
    };
  }

  // ---------------- reviews ----------------
  async reviews(from: Date, to: Date, granularity: Granularity = Granularity.MONTHLY) {
    const where: Prisma.ReviewWhereInput = { deletedAt: null, status: ReviewStatus.PUBLISHED, createdAt: { gte: from, lte: to } };
    const [agg, dist] = await Promise.all([
      this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: true }),
    ]);
    const satisfied = dist.filter((d) => d.rating >= 4).reduce((s, d) => s + d._count, 0);
    const trend = await this.prisma.$queryRaw<{ bucket: Date; avg: number }[]>(Prisma.sql`
      SELECT date_trunc(${Prisma.raw(`'${GRANULARITY_UNIT[granularity]}'`)}, created_at) AS bucket, AVG(rating)::float AS avg
      FROM reviews WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND created_at >= ${from} AND created_at <= ${to}
      GROUP BY bucket ORDER BY bucket`);
    return {
      average_rating: agg._avg.rating ? +Number(agg._avg.rating).toFixed(2) : 0,
      total_reviews: agg._count,
      distribution: dist.map((d) => ({ label: String(d.rating), value: d._count })).sort((a, b) => Number(b.label) - Number(a.label)),
      satisfaction_rate: agg._count ? +(satisfied / agg._count).toFixed(4) : 0,
      trend: trend.map((t) => ({ bucket: t.bucket.toISOString().slice(0, 10), value: +Number(t.avg).toFixed(2) })),
    };
  }

  // ---------------- helper: single-table date_trunc count series ----------------
  private async bucketSeries(table: 'bookings', from: Date, to: Date, granularity: Granularity): Promise<TimeSeriesPoint[]> {
    const rows = await this.prisma.$queryRaw<{ bucket: Date; n: number }[]>(Prisma.sql`
      SELECT date_trunc(${Prisma.raw(`'${GRANULARITY_UNIT[granularity]}'`)}, created_at) AS bucket, COUNT(*)::int AS n
      FROM ${Prisma.raw(table)} WHERE deleted_at IS NULL AND created_at >= ${from} AND created_at <= ${to}
      GROUP BY bucket ORDER BY bucket`);
    return rows.map((r) => ({ bucket: r.bucket.toISOString().slice(0, 10), value: Number(r.n) }));
  }
}
