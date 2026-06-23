// src/modules/users/users.service.ts
//
// User CRUD + admin management. Authorization is enforced here (defense in depth — the
// controllers also gate by role): non-admins may only read/update themselves; role changes
// require SUPER_ADMIN. Status/role changes and soft deletes write an AuditLog row.
//
// OWNER PROTECTION: the account whose email matches OWNER_EMAIL is permanently protected —
// it cannot be suspended, deactivated, deleted, or demoted. This is enforced server-side
// regardless of who the actor is (even another SUPER_ADMIN cannot remove this account).

import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { Paginated } from 'src/common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CreateAdminDto, UpdateUserDto, UpdateUserRoleDto, UpdateUserStatusDto, UserFilterDto } from './dto';

const OWNER_EMAIL = 'contact@dnrpestcontrol.in';
const BCRYPT_ROUNDS = 12;

type UserRow = Prisma.UserGetPayload<{
  select: {
    id: true; email: true; fullName: true; phone: true; role: true; adminRole: true;
    permissions: true; status: true; emailVerified: true; createdAt: true;
  };
}>;

const PUBLIC_SELECT = {
  id: true, email: true, fullName: true, phone: true, role: true, adminRole: true,
  permissions: true, status: true, emailVerified: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.ADMIN;
  }

  private isSuperAdmin(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.ADMIN && actor.adminRole === AdminRole.SUPER_ADMIN;
  }

  private toPublic(u: UserRow) {
    return {
      id: u.id, email: u.email, full_name: u.fullName, phone: u.phone, role: u.role,
      admin_role: u.adminRole, permissions: u.permissions, status: u.status,
      email_verified: u.emailVerified, created_at: u.createdAt,
      is_owner: u.email === OWNER_EMAIL,
    };
  }

  // ---- self ----
  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { customerProfile: true, technicianProfile: { include: { serviceAreas: true } } },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    const { customerProfile, technicianProfile, ...base } = user;
    return { ...this.toPublic(base as UserRow), profile: customerProfile ?? technicianProfile ?? null };
  }

  // ---- read by id (admin or self) ----
  async findById(id: string, actor: AuthenticatedUser) {
    if (!this.isAdmin(actor) && actor.id !== id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only view your own account' });
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { customerProfile: true, technicianProfile: { include: { serviceAreas: true } } },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    const { customerProfile, technicianProfile, ...base } = user;
    return { ...this.toPublic(base as UserRow), profile: customerProfile ?? technicianProfile ?? null };
  }

  // ---- update (self → name/phone only; admin → same set here) ----
  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    if (!this.isAdmin(actor) && actor.id !== id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only update your own account' });
    }
    await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { fullName: dto.fullName, phone: dto.phone },
      select: PUBLIC_SELECT,
    });
    this.logger.log(`User ${id} profile updated by ${actor.id}`);
    return this.toPublic(user);
  }

  // ---- soft delete (admin only) ----
  async softDelete(id: string, actor: AuthenticatedUser) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    const target = await this.ensureExists(id);
    if (target.email === OWNER_EMAIL) {
      throw new ForbiddenException({ code: 'OWNER_PROTECTED', message: 'The owner account cannot be deleted' });
    }
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.DEACTIVATED },
    });
    await this.audit(actor.id, 'user.soft_deleted', id);
    this.logger.warn(`User ${id} soft-deleted by ${actor.id}`);
    return { success: true };
  }

  // ---- admin: list / search / filter / paginate ----
  async list(filter: UserFilterDto): Promise<Paginated<ReturnType<UsersService['toPublic']>>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(filter.role ? { role: filter.role } : {}),
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
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = filter.sort
      ? { [filter.sort]: filter.order }
      : { createdAt: filter.order };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: PUBLIC_SELECT, orderBy, skip: filter.skip, take: filter.limit }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(rows.map((r) => this.toPublic(r)), total, filter.page, filter.limit);
  }

  // ---- admin: status change ----
  async setStatus(id: string, dto: UpdateUserStatusDto, actor: AuthenticatedUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Admin access required' });
    const target = await this.ensureExists(id);
    if (target.email === OWNER_EMAIL && dto.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'OWNER_PROTECTED',
        message: 'The owner account cannot be suspended or deactivated',
      });
    }
    const user = await this.prisma.user.update({
      where: { id },
      // Reactivating clears a prior soft-delete tombstone.
      data: { status: dto.status, ...(dto.status === UserStatus.ACTIVE ? { deletedAt: null } : {}) },
      select: PUBLIC_SELECT,
    });
    await this.audit(actor.id, 'user.status_changed', id, { status: dto.status, reason: dto.reason });
    this.logger.log(`User ${id} status → ${dto.status} by ${actor.id}`);
    return this.toPublic(user);
  }

  // ---- admin: role change (SUPER_ADMIN only — privilege escalation control) ----
  async setRole(id: string, dto: UpdateUserRoleDto, actor: AuthenticatedUser) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only a Super Admin can change roles' });
    }
    const target = await this.ensureExists(id);
    if (target.email === OWNER_EMAIL) {
      if (dto.role !== UserRole.ADMIN || dto.adminRole !== AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException({
          code: 'OWNER_PROTECTED',
          message: 'The owner account role cannot be downgraded',
        });
      }
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
        adminRole: dto.role === UserRole.ADMIN ? (dto.adminRole ?? null) : null,
        permissions: dto.permissions ?? [],
      },
      select: PUBLIC_SELECT,
    });
    await this.audit(actor.id, 'user.role_changed', id, { role: dto.role, adminRole: dto.adminRole });
    this.logger.warn(`User ${id} role → ${dto.role} by ${actor.id}`);
    return this.toPublic(user);
  }

  // ---- admin: create admin account (SUPER_ADMIN only) ----
  async createAdmin(dto: CreateAdminDto, actor: AuthenticatedUser) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only a Super Admin can create admin accounts' });
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_IN_USE', message: 'An account with this email already exists' });
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.ADMIN,
        adminRole: dto.adminRole,
        passwordHash,
        permissions: dto.permissions ?? [],
        emailVerified: true,
      },
      select: PUBLIC_SELECT,
    });
    await this.audit(actor.id, 'user.admin_created', user.id, { adminRole: dto.adminRole });
    this.logger.warn(`Admin ${user.id} (${dto.adminRole}) created by ${actor.id}`);
    return this.toPublic(user);
  }

  // ---- helpers ----
  private async ensureExists(id: string): Promise<{ email: string; adminRole: AdminRole | null }> {
    const exists = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, adminRole: true },
    });
    if (!exists) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return exists;
  }

  private async audit(actorId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entityType: 'user', entityId, metadata },
    });
  }
}