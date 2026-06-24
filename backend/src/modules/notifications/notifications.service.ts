// src/modules/notifications/notifications.service.ts
//
// Notification center (list / unread / mark read / mark all / delete), device-token
// registration, preference reads/writes, and admin send/broadcast (delegating to the
// dispatcher). All center + device operations are scoped to the calling user.

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NotificationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { paginate } from "src/common/utils/pagination.util";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { NotificationPreferencesService } from "./notification-preferences.service";
import {
  BroadcastNotificationDto,
  NotificationFilterDto,
  NotificationPreferenceDto,
  RegisterDeviceDto,
  SendNotificationDto,
} from "./dto";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly prefs: NotificationPreferencesService,
  ) {}

  // ---------------- Notification center ----------------
  async list(actor: AuthenticatedUser, filter: NotificationFilterDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(filter.type ? { type: filter.type } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(
      rows.map((r) => this.toResponse(r)),
      total,
      filter.page,
      filter.limit,
    );
  }

  async unread(actor: AuthenticatedUser) {
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      readAt: null,
    };
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { count, notifications: rows.map((r) => this.toResponse(r)) };
  }

  async markRead(actor: AuthenticatedUser, id: string) {
    const res = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, readAt: null },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    if (res.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId: actor.id },
        select: { id: true },
      });
      if (!exists)
        throw new NotFoundException({
          code: "NOTIFICATION_NOT_FOUND",
          message: "Notification not found",
        });
    }
    return { success: true };
  }

  async markAllRead(actor: AuthenticatedUser) {
    const res = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { updated: res.count };
  }

  async remove(actor: AuthenticatedUser, id: string) {
    const res = await this.prisma.notification.deleteMany({
      where: { id, userId: actor.id },
    });
    if (res.count === 0)
      throw new NotFoundException({
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found",
      });
    return { success: true };
  }

  // ---------------- Devices ----------------
  async registerDevice(actor: AuthenticatedUser, dto: RegisterDeviceDto) {
    // Token is globally unique; reassign to this user if it was registered elsewhere.
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId: actor.id, platform: dto.platform },
      create: { userId: actor.id, token: dto.token, platform: dto.platform },
    });
    return { id: device.id, platform: device.platform };
  }

  async removeDevice(actor: AuthenticatedUser, token: string) {
    const res = await this.prisma.deviceToken.deleteMany({
      where: { token, userId: actor.id },
    });
    if (res.count === 0)
      throw new NotFoundException({
        code: "INVALID_DEVICE_TOKEN",
        message: "Device token not found",
      });
    return { success: true };
  }

  // ---------------- Preferences ----------------
  getPreferences(actor: AuthenticatedUser) {
    return { preferences: this.prefs.getPreferences(actor.id) };
  }

  updatePreferences(actor: AuthenticatedUser, dto: NotificationPreferenceDto) {
    return this.prefs.updatePreferences(actor.id, dto);
  }

  // ---------------- Admin send / broadcast ----------------
  async send(dto: SendNotificationDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      select: { id: true },
    });
    if (!recipient)
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Recipient not found",
      });
    return this.dispatcher.dispatch(dto.userId, {
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data,
    });
  }

  broadcast(dto: BroadcastNotificationDto) {
    return this.dispatcher.broadcast(
      {
        type: dto.type ?? "SYSTEM",
        title: dto.title,
        body: dto.body,
        data: dto.data,
      },
      dto.role,
    );
  }

  private toResponse(n: {
    id: string;
    type: string;
    status: string;
    title: string;
    body: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: n.id,
      type: n.type,
      status: n.status,
      title: n.title,
      body: n.body,
      data: n.data ?? null,
      read: n.readAt != null,
      read_at: n.readAt,
      created_at: n.createdAt,
    };
  }
}
