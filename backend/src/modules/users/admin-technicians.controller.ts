// src/modules/users/admin-technicians.controller.ts
//
// Admin-only technician management: list, get, create, update profile.
// All routes require ADMIN role. Returns snake_case responses to match the
// admin dashboard's TechnicianProfile / TechnicianRow types.

import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import {
  ArrayUnique, IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString,
  Matches, MaxLength, MinLength,
} from 'class-validator';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { UsersService } from './users.service';
import { AttendanceService } from '../attendance/attendance.service';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

// ── DTOs ─────────────────────────────────────────────────────────────────────

class TechnicianFilterDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() is_available?: string;
}

class AttendanceFilterDto extends PaginationQueryDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() technician_id?: string;
  @IsOptional() @IsString() user_id?: string;
}

class CreateTechnicianDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  fullName!: string;

  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @IsOptional() @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Phone must be a valid international number' })
  phone?: string;

  @IsOptional() @IsString() @MaxLength(100)
  licenseNumber?: string;

  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  skills?: string[];
}

class UpdateTechnicianDto {
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  skills?: string[];

  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  service_area_ids?: string[];

  @IsOptional() @IsBoolean()
  is_available?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  license_number?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toRow(u: {
  id: string; email: string; fullName: string; phone: string | null; status: string;
  technicianProfile: {
    isAvailable: boolean; ratingAverage: unknown; jobsCompleted: number;
    dutyLogs: { id: string }[];
  } | null;
}) {
  return {
    id: u.id,
    full_name: u.fullName,
    email: u.email,
    phone: u.phone,
    status: u.status,
    is_available: u.technicianProfile?.isAvailable ?? false,
    on_duty: (u.technicianProfile?.dutyLogs?.length ?? 0) > 0,
    rating: u.technicianProfile?.ratingAverage != null
      ? Number(u.technicianProfile.ratingAverage)
      : undefined,
    completed_jobs: u.technicianProfile?.jobsCompleted,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller({ path: 'admin/technicians', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTechniciansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get()
  async list(@Query() filter: TechnicianFilterDto) {
    const where: Record<string, unknown> = {
      role: UserRole.TECHNICIAN,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
              { phone: { contains: filter.search } },
            ],
          }
        : {}),
      ...(filter.is_available != null && filter.is_available !== ''
        ? { technicianProfile: { isAvailable: filter.is_available === 'true' } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, fullName: true, phone: true, status: true,
          technicianProfile: {
            select: {
              isAvailable: true, ratingAverage: true, jobsCompleted: true,
              dutyLogs: {
                where: { date: todayUtc(), punchedOutAt: null },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: filter.order ?? 'desc' },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(rows.map(toRow), total, filter.page, filter.limit);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.prisma.user.findFirst({
      where: { id, role: UserRole.TECHNICIAN, deletedAt: null },
      select: {
        id: true, email: true, fullName: true, phone: true, status: true, createdAt: true,
        technicianProfile: {
          select: {
            id: true, licenseNumber: true, licenseExpiry: true, skills: true,
            isAvailable: true, ratingAverage: true, jobsCompleted: true,
            serviceAreas: { select: { id: true, name: true } },
            dutyLogs: {
              where: { date: todayUtc(), punchedOutAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!u) return null;
    const p = u.technicianProfile;
    return {
      id: u.id,
      user_id: u.id,
      full_name: u.fullName,
      email: u.email,
      phone: u.phone,
      status: u.status,
      joined_at: u.createdAt,
      is_available: p?.isAvailable ?? false,
      on_duty: (p?.dutyLogs?.length ?? 0) > 0,
      license_number: p?.licenseNumber,
      license_expiry: p?.licenseExpiry,
      skills: p?.skills ?? [],
      rating: p?.ratingAverage != null ? Number(p.ratingAverage) : undefined,
      completed_jobs: p?.jobsCompleted,
      service_areas: p?.serviceAreas ?? [],
    };
  }

  @Post()
  async create(
    @Body() dto: CreateTechnicianDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      return { error: { code: 'EMAIL_TAKEN', message: 'A user with this email already exists' } };
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.TECHNICIAN,
        passwordHash,
        emailVerified: true,
        status: UserStatus.ACTIVE,
        technicianProfile: {
          create: {
            licenseNumber: dto.licenseNumber,
            skills: dto.skills ?? [],
            isAvailable: true,
          },
        },
      },
      select: { id: true, email: true, fullName: true, phone: true, status: true, createdAt: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id, action: 'technician.created', entityType: 'user',
        entityId: user.id, metadata: { email: dto.email },
      },
    });
    return { id: user.id, email: user.email, full_name: user.fullName, status: user.status };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTechnicianDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { userId: id }, select: { id: true },
    });
    if (!profile) return { error: { code: 'NOT_FOUND', message: 'Technician profile not found' } };

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianProfile.update({
        where: { id: profile.id },
        data: {
          ...(dto.skills !== undefined ? { skills: dto.skills } : {}),
          ...(dto.is_available !== undefined ? { isAvailable: dto.is_available } : {}),
          ...(dto.license_number !== undefined ? { licenseNumber: dto.license_number } : {}),
        },
      });
      if (dto.service_area_ids) {
        await tx.serviceArea.updateMany({
          where: { technicianId: profile.id, id: { notIn: dto.service_area_ids } },
          data: { technicianId: null },
        });
        if (dto.service_area_ids.length) {
          await tx.serviceArea.updateMany({
            where: { id: { in: dto.service_area_ids } },
            data: { technicianId: profile.id },
          });
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id, action: 'technician.profile_updated', entityType: 'user',
        entityId: id, metadata: JSON.parse(JSON.stringify(dto)),
      },
    });

    return this.getOne(id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.setStatus(id, dto as { status: UserStatus; reason?: string }, actor);
  }

  // ── Attendance (admin view) ──────────────────────────────────────────────────

  @Get('attendance')
  getAttendance(@Query() filter: AttendanceFilterDto) {
    return this.attendance.adminList({
      date: filter.date,
      from: filter.from,
      to: filter.to,
      technicianId: filter.technician_id,
      userId: filter.user_id,
      page: filter.page,
      limit: filter.limit,
    });
  }
}
