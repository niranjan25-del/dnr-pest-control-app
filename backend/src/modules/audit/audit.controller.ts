// src/modules/audit/audit.controller.ts
// /audit — read-only audit trail for admins. Append-only by design; no delete/update routes.
// Filterable by actorId, entityType, action prefix, and date range.

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";
import { Transform } from "class-transformer";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

class AuditFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID("4")
  actorId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@Controller({ path: "audit", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() filter: AuditFilterDto) {
    const where = {
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.action ? { action: { startsWith: filter.action } } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(
      rows.map((r) => ({
        id: r.id.toString(),
        actor_name: r.actor?.fullName ?? null,
        actor_email: r.actor?.email ?? null,
        action: r.action,
        entity_type: r.entityType,
        entity_id: r.entityId,
        metadata: r.metadata,
        ip_address: r.ipAddress,
        created_at: r.createdAt,
      })),
      total,
      filter.page,
      filter.limit,
    );
  }
}
