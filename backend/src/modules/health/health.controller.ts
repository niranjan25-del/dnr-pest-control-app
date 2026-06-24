// src/modules/health/health.controller.ts
//
// Liveness/readiness endpoints. `/api/v1/health` is used by the ALB target group, the
// Docker HEALTHCHECK, and the CI/CD smoke tests. `/ready` additionally pings the DB so a
// task only receives traffic once Postgres is reachable.

import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  liveness() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @Version(VERSION_NEUTRAL)
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
}
