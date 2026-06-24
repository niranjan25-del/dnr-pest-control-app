// src/modules/analytics/analytics.controller.ts
//
// /analytics routes. Admin (incl. Operations Manager, who is UserRole.ADMIN) has full reporting
// access; technicians get limited personal analytics on /technicians (scoped in the service);
// customers have no access. Dashboard/report/export actions are audited.

import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles, CurrentUser } from "../auth/decorators";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { PrismaService } from "src/database/prisma.service";
import { AnalyticsService } from "./analytics.service";
import { DashboardService } from "./dashboard.service";
import { ReportsService } from "./reports.service";
import { ExportService } from "./export.service";
import {
  BookingReportDto,
  CustomerReportDto,
  DashboardFilterDto,
  ExportReportDto,
  RevenueReportDto,
  TechnicianReportDto,
} from "./dto";
import { Granularity } from "./enums";

@Controller({ path: "analytics", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly dashboard: DashboardService,
    private readonly reports: ReportsService,
    private readonly exporter: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------- dashboards / analytics ----------------
  @Get("dashboard")
  @Roles(UserRole.ADMIN)
  async dashboardKpis(@CurrentUser() actor: AuthenticatedUser) {
    const kpis = await this.dashboard.kpis();
    await this.audit(actor.id, "analytics.dashboard_viewed");
    return kpis;
  }

  @Get("revenue")
  @Roles(UserRole.ADMIN)
  revenue(@Query() q: RevenueReportDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.revenue(from, to, q.granularity ?? Granularity.DAILY);
  }

  @Get("bookings")
  @Roles(UserRole.ADMIN)
  bookings(@Query() q: BookingReportDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.bookings(
      from,
      to,
      q.granularity ?? Granularity.DAILY,
    );
  }

  @Get("customers")
  @Roles(UserRole.ADMIN)
  customers(@Query() q: CustomerReportDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.customers(from, to);
  }

  @Get("technicians")
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN) // technicians see only their own (scoped in service)
  technicians(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() q: TechnicianReportDto,
  ) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.technicians(actor, from, to);
  }

  @Get("services")
  @Roles(UserRole.ADMIN)
  services(@Query() q: RevenueReportDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.services(
      from,
      to,
      q.granularity ?? Granularity.MONTHLY,
    );
  }

  @Get("subscriptions")
  @Roles(UserRole.ADMIN)
  subscriptions(@Query() q: DashboardFilterDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.subscriptions(from, to);
  }

  // Additive (flagged): review analytics (required feature; not in the original endpoint list).
  @Get("reviews")
  @Roles(UserRole.ADMIN)
  reviews(@Query() q: DashboardFilterDto) {
    const { from, to } = this.analytics.range(q.from, q.to);
    return this.analytics.reviews(from, to);
  }

  // ---------------- structured reports ----------------
  @Post("reports/revenue")
  @Roles(UserRole.ADMIN)
  reportRevenue(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() q: RevenueReportDto,
  ) {
    const { from, to } = this.analytics.range(q.from, q.to);
    void this.audit(actor.id, "analytics.report_generated", "revenue");
    return this.reports.revenue(from, to, q.granularity ?? Granularity.DAILY);
  }

  @Post("reports/bookings")
  @Roles(UserRole.ADMIN)
  reportBookings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() q: BookingReportDto,
  ) {
    const { from, to } = this.analytics.range(q.from, q.to);
    void this.audit(actor.id, "analytics.report_generated", "bookings");
    return this.reports.bookings(from, to, q.granularity ?? Granularity.DAILY);
  }

  @Post("reports/customers")
  @Roles(UserRole.ADMIN)
  reportCustomers(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() q: CustomerReportDto,
  ) {
    const { from, to } = this.analytics.range(q.from, q.to);
    void this.audit(actor.id, "analytics.report_generated", "customers");
    return this.reports.customers(from, to);
  }

  @Post("reports/technicians")
  @Roles(UserRole.ADMIN)
  reportTechnicians(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() q: TechnicianReportDto,
  ) {
    const { from, to } = this.analytics.range(q.from, q.to);
    void this.audit(actor.id, "analytics.report_generated", "technicians");
    return this.reports.technicians(actor, from, to);
  }

  // ---------------- export ----------------
  @Post("export")
  @Roles(UserRole.ADMIN)
  async export(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ExportReportDto,
  ) {
    const { from, to } = this.analytics.range(dto.from, dto.to);
    const report =
      dto.reportType === "REVENUE"
        ? await this.reports.revenue(
            from,
            to,
            dto.granularity ?? Granularity.DAILY,
          )
        : dto.reportType === "BOOKINGS"
          ? await this.reports.bookings(
              from,
              to,
              dto.granularity ?? Granularity.DAILY,
            )
          : dto.reportType === "CUSTOMERS"
            ? await this.reports.customers(from, to)
            : dto.reportType === "TECHNICIANS"
              ? await this.reports.technicians(actor, from, to)
              : await this.reports.subscriptions(from, to);
    const result = await this.exporter.export(report, dto.format);
    await this.audit(
      actor.id,
      "analytics.export_generated",
      `${dto.reportType}:${dto.format}`,
    );
    return result;
  }

  private audit(actorId: string, action: string, detail?: string) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: "analytics",
        entityId: detail ?? "dashboard",
      },
    });
  }
}
