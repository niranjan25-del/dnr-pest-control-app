// src/modules/invoices/invoices.controller.ts
//
// /invoices routes. Reads are role-scoped in the service (customer/technician/admin); create,
// regenerate, void, and export are ADMIN. Static routes (customer/history, export) precede
// :id so they aren't captured by the param matcher.

import {
  Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Res, StreamableFile, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, InvoiceFilterDto, RegenerateInvoiceDto, VoidInvoiceDto } from './dto';

@Controller({ path: 'invoices', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filter: InvoiceFilterDto) {
    return this.invoices.list(actor, filter);
  }

  // --- static routes before :id ---
  @Get('customer/history')
  @Roles(UserRole.CUSTOMER)
  history(@CurrentUser() actor: AuthenticatedUser, @Query() filter: InvoiceFilterDto) {
    return this.invoices.customerHistory(actor, filter);
  }

  // Additive (flagged): admin billing-records export.
  @Get('export')
  @Roles(UserRole.ADMIN)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="invoices.csv"')
  export(@CurrentUser() actor: AuthenticatedUser, @Query() filter: InvoiceFilterDto) {
    return this.invoices.exportCsv(actor, filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.invoices.findById(id, actor);
  }

  @Get(':id/download')
  @Header('Content-Type', 'application/pdf')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.invoices.download(id, actor);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Post(':id/regenerate')
  @Roles(UserRole.ADMIN)
  regenerate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: RegenerateInvoiceDto) {
    return this.invoices.regenerate(id, actor, dto);
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN)
  void(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser, @Body() dto: VoidInvoiceDto) {
    return this.invoices.void(id, actor, dto.reason);
  }
}
