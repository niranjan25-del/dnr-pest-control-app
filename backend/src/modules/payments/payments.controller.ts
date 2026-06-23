// src/modules/payments/payments.controller.ts
//
// /payments routes. Reads are role-scoped in the service (customer own / technician assigned /
// admin all). Refund is ADMIN-only. Payment-method (instrument) management is CUSTOMER.
// Static routes precede :id.

import {
  Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  ConfirmPaymentDto, CreatePaymentIntentDto, PaymentFilterDto, RefundPaymentDto,
} from './dto';

class MobileCreateIntentDto {
  @IsUUID('4', { message: 'A valid invoice_id is required' })
  invoice_id!: string;

  @IsOptional() @IsBoolean()
  save_payment_method?: boolean;
}

@Controller({ path: 'payments', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  // Returns { order_id, payment_session_id, ... } — JS SDK uses payment_session_id
  // to launch Cashfree checkout, then calls /confirm with order_id after completion.
  @Post('create-intent')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  createIntent(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePaymentIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.createIntent(actor, dto, idempotencyKey);
  }

  // Mobile alias: accepts invoice_id instead of bookingId (Flutter flow).
  @Post('intent')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async createIntentMobile(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MobileCreateIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoice_id }, select: { bookingId: true },
    });
    if (!invoice?.bookingId) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found or not tied to a booking' });
    }
    return this.payments.createIntent(
      actor,
      { bookingId: invoice.bookingId, savePaymentMethod: dto.save_payment_method },
      idempotencyKey,
    );
  }

  // Flutter calls this after Cashfree checkout completes, passing the order_id.
  @Post('confirm')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  confirm(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ConfirmPaymentDto) {
    return this.payments.confirm(actor, dto.orderId);
  }

  // Mobile alias: confirm by internal payment UUID (Flutter passes payment_id from create-intent response).
  @Post(':id/confirm')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async confirmByPaymentId(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    const payment = await this.prisma.payment.findFirst({
      where: { id }, select: { providerTransactionId: true },
    });
    if (!payment?.providerTransactionId) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }
    return this.payments.confirm(actor, payment.providerTransactionId);
  }

  @Post('refund')
  @Roles(UserRole.ADMIN)
  refund(@CurrentUser() actor: AuthenticatedUser, @Body() dto: RefundPaymentDto) {
    return this.payments.refund(actor, dto);
  }

  @Get('history')
  history(@CurrentUser() actor: AuthenticatedUser, @Query() filter: PaymentFilterDto) {
    return this.payments.history(actor, filter);
  }

  // ----- saved instruments (Cashfree-backed; customer) -----
  @Get('payment-methods')
  @Roles(UserRole.CUSTOMER)
  listPaymentMethods(@CurrentUser() actor: AuthenticatedUser) {
    return this.payments.listPaymentMethods(actor);
  }

  @Delete('payment-methods/:id')
  @Roles(UserRole.CUSTOMER)
  removePaymentMethod(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.removePaymentMethod(actor, id);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.findById(id, actor);
  }
}
