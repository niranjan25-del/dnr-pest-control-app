// src/modules/service-reports/service-reports.controller.ts
//
// /service-reports routes. Technician manages their assigned report (create/update/submit/
// signature); customer views/downloads own; admin full access + approve/reject/archive/
// compliance (additive, flagged). Static routes (customer/history, compliance) precede :id.

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { ServiceReportsService } from './service-reports.service';
import { ComplianceService } from './compliance.service';
import {
  CreateServiceReportDto, RejectReportDto, ReportFilterDto, SubmitReportDto, UpdateServiceReportDto, UploadSignatureDto,
} from './dto';

@Controller({ path: 'service-reports', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceReportsController {
  constructor(
    private readonly reports: ServiceReportsService,
    private readonly compliance: ComplianceService,
  ) {}

  @Post()
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateServiceReportDto) {
    return this.reports.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filter: ReportFilterDto) {
    return this.reports.list(actor, filter);
  }

  // --- static routes before :id ---
  @Get('customer/history')
  @Roles(UserRole.CUSTOMER)
  history(@CurrentUser() actor: AuthenticatedUser, @Query() filter: ReportFilterDto) {
    return this.reports.customerHistory(actor, filter);
  }

  // Additive (flagged): compliance chemical-usage report.
  @Get('compliance/chemical-usage')
  @Roles(UserRole.ADMIN)
  chemicalUsage(@Query('from') from?: string, @Query('to') to?: string, @Query('technicianId') technicianId?: string) {
    return this.compliance.chemicalUsage({ from, to, technicianId });
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.findById(actor, id);
  }

  @Get(':id/pdf')
  pdf(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.getPdfUrl(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceReportDto) {
    return this.reports.update(actor, id, dto);
  }

  @Post(':id/submit')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  submit(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitReportDto) {
    return this.reports.submit(actor, id, dto);
  }

  @Post(':id/signature')
  @Roles(UserRole.TECHNICIAN, UserRole.ADMIN)
  signature(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadSignatureDto) {
    return this.reports.captureSignature(actor, id, dto.imageBase64);
  }

  // --- additive admin actions (flagged) ---
  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.approve(actor, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  reject(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectReportDto) {
    return this.reports.reject(actor, id, dto.reason);
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN)
  archive(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.archive(actor, id);
  }
}
