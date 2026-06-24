// src/database/prisma.module.ts
//
// Global module so PrismaService is injectable everywhere without re-importing. Marked
// @Global() because virtually every feature module needs DB access.

import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
