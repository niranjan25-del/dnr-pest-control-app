// src/modules/users/admin-customers.controller.ts
//
// Admin-only customer management.
// Routes:
//   POST   /admin/customers                            — create a customer account manually
//   GET    /admin/customers                            — paginated search (name/email/phone)
//   GET    /admin/customers/:userId                    — full customer detail
//   PATCH  /admin/customers/:userId                    — update name/phone/company/type
//   GET    /admin/customers/:userId/addresses          — list saved addresses
//   POST   /admin/customers/:userId/addresses          — create address on behalf of customer
//   PATCH  /admin/customers/:userId/addresses/:addrId  — update / set-default address
//   DELETE /admin/customers/:userId/addresses/:addrId  — soft-delete address

import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingStatus, CustomerType, InvoiceStatus, UserRole, UserStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';

const BCRYPT_ROUNDS = 12;

// ── DTOs ─────────────────────────────────────────────────────────────────────

class CreateCustomerDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  fullName!: string;

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @IsOptional() @IsString()
  @Matches(/^\+?\d{7,15}$/, { message: 'Phone must be 7–15 digits, optionally starting with +' })
  phone?: string;
}

class UpdateCustomerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  fullName?: string;

  @IsOptional() @IsString()
  @Matches(/^\+?\d{7,15}$/, { message: 'Phone must be 7–15 digits, optionally starting with +' })
  phone?: string;

  @IsOptional() @IsString() @MaxLength(160)
  companyName?: string;

  @IsOptional() @IsEnum(['RESIDENTIAL', 'COMMERCIAL'])
  customerType?: string;
}

class CustomerFilterDto extends PaginationQueryDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsEnum(['RESIDENTIAL', 'COMMERCIAL'])
  customer_type?: string;
}

class CreateAddressForCustomerDto {
  @IsOptional() @IsString() @MaxLength(100)
  label?: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  line1!: string;

  @IsOptional() @IsString() @MaxLength(255)
  line2?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  city!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  state!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  postalCode!: string;

  @IsOptional() @IsString() @MaxLength(10)
  country?: string;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

class UpdateAddressDto {
  @IsOptional() @IsString() @MaxLength(100)
  label?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255)
  line1?: string;

  @IsOptional() @IsString() @MaxLength(255)
  line2?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  city?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  state?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20)
  postalCode?: string;

  @IsOptional() @IsString() @MaxLength(10)
  country?: string;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller({ path: 'admin/customers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCustomersController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create customer ───────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateCustomerDto, @CurrentUser() actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.CUSTOMER,
        passwordHash,
        emailVerified: true,
        status: UserStatus.ACTIVE,
        customerProfile: { create: {} },
      },
      select: { id: true, email: true, fullName: true, phone: true, status: true, createdAt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'customer.created',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: dto.email, createdBy: 'admin' },
      },
    });

    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      created_at: user.createdAt,
    };
  }

  // ── List customers ────────────────────────────────────────────────────────

  @Get()
  async list(@Query() filter: CustomerFilterDto) {
    const where: Record<string, unknown> = {
      role: UserRole.CUSTOMER,
      deletedAt: null,
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
              { phone: { contains: filter.search } },
            ],
          }
        : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customer_type ? { customerProfile: { customerType: filter.customer_type } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          createdAt: true,
          customerProfile: { select: { id: true, customerType: true } },
        },
        orderBy: { fullName: 'asc' },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = rows.map((u) => ({
      id: u.id,
      customer_profile_id: u.customerProfile?.id ?? null,
      full_name: u.fullName,
      email: u.email,
      phone: u.phone,
      status: u.status,
      customer_type: u.customerProfile?.customerType ?? null,
      created_at: u.createdAt,
    }));

    return paginate(data, total, filter.page, filter.limit);
  }

  // ── Customer detail ───────────────────────────────────────────────────────

  @Get(':userId')
  async getOne(@Param('userId', ParseUUIDPipe) userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CUSTOMER, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        customerProfile: {
          select: {
            id: true,
            customerType: true,
            companyName: true,
            _count: { select: { addresses: { where: { deletedAt: null } } } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    return {
      id: user.id,
      user_id: user.id,
      customer_profile_id: user.customerProfile?.id ?? null,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      customer_type: user.customerProfile?.customerType ?? null,
      company_name: user.customerProfile?.companyName ?? null,
      address_count: user.customerProfile?._count?.addresses ?? 0,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  // ── Update customer profile ───────────────────────────────────────────────

  @Patch(':userId')
  async updateOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CUSTOMER, deletedAt: null },
      select: { id: true, customerProfile: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    await this.prisma.$transaction(async (tx) => {
      if (dto.fullName !== undefined || dto.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          },
        });
      }
      if ((dto.companyName !== undefined || dto.customerType !== undefined) && user.customerProfile) {
        await tx.customerProfile.update({
          where: { id: user.customerProfile.id },
          data: {
            ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
            ...(dto.customerType !== undefined ? { customerType: dto.customerType as any } : {}),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'customer.updated',
          entityType: 'user',
          entityId: userId,
          metadata: JSON.parse(JSON.stringify(dto)),
        },
      });
    });

    return this.getOne(userId);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get(':userId/stats')
  async getStats(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    const ACTIVE_STATUSES = [
      BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE,
      BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS,
    ];

    const [totalBookings, completedBookings, cancelledBookings, activeBookings, spendAgg, ratingAgg] =
      await this.prisma.$transaction([
        this.prisma.booking.count({ where: { customerId: profile.id, deletedAt: null } }),
        this.prisma.booking.count({ where: { customerId: profile.id, deletedAt: null, status: BookingStatus.COMPLETED } }),
        this.prisma.booking.count({ where: { customerId: profile.id, deletedAt: null, status: BookingStatus.CANCELLED } }),
        this.prisma.booking.count({ where: { customerId: profile.id, deletedAt: null, status: { in: ACTIVE_STATUSES } } }),
        this.prisma.invoice.aggregate({
          where: { customerId: profile.id, deletedAt: null, status: InvoiceStatus.PAID },
          _sum: { totalAmount: true },
        }),
        this.prisma.review.aggregate({
          where: { customerId: profile.id, deletedAt: null },
          _avg: { rating: true },
          _count: { id: true },
        }),
      ]);

    return {
      total_bookings: totalBookings,
      completed_bookings: completedBookings,
      cancelled_bookings: cancelledBookings,
      active_bookings: activeBookings,
      total_spend: Number(spendAgg._sum.totalAmount ?? 0),
      avg_rating: ratingAgg._avg.rating != null ? Number(ratingAgg._avg.rating).toFixed(1) : null,
      reviews_count: ratingAgg._count.id,
    };
  }

  // ── Addresses ─────────────────────────────────────────────────────────────

  @Get(':userId/addresses')
  async getAddresses(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer profile not found' });
    }

    return this.prisma.address.findMany({
      where: { customerId: profile.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Post(':userId/addresses')
  async createAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateAddressForCustomerDto,
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer profile not found' });
    }

    const customerId = profile.id;

    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({
        where: { customerId, deletedAt: null },
      });
      const makeDefault = dto.isDefault === true || existingCount === 0;

      if (makeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          customerId,
          label: dto.label,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country ?? 'IN',
          isDefault: makeDefault,
        },
      });
    });
  }

  @Patch(':userId/addresses/:addressId')
  async updateAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId: profile.id, deletedAt: null },
    });
    if (!address) throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { customerId: profile.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
          ...(dto.line2 !== undefined ? { line2: dto.line2 } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.state !== undefined ? { state: dto.state } : {}),
          ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
          ...(dto.country !== undefined ? { country: dto.country } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });
  }

  @Delete(':userId/addresses/:addressId')
  @HttpCode(204)
  async deleteAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });

    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId: profile.id, deletedAt: null },
    });
    if (!address) throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });

    await this.prisma.address.update({ where: { id: addressId }, data: { deletedAt: new Date() } });
  }
}
