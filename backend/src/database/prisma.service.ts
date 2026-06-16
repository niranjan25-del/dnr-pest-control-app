// src/database/prisma.service.ts
//
// Single PrismaClient for the app, wired to Nest's lifecycle: connects on module init and
// disconnects on destroy. Query/error logging is forwarded to the app logger. This is the
// class every repository/service injects (and the one tests override with a test client).

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    // @ts-expect-error Prisma event typings are loose for the union of log levels
    this.$on('warn', (e) => this.logger.warn(e.message));
    // @ts-expect-error see above
    this.$on('error', (e) => this.logger.error(e.message));
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
