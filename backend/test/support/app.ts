// test/support/app.ts
//
// Boots the real AppModule into a Nest application configured exactly like production
// (global prefix, versioning, validation pipe, exception filter) for supertest. SDKs are
// mocked by setup-e2e.ts. Returns the app + a Prisma handle for seeding/cleanup.

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/database/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/** Truncate mutable tables between specs (order respects FKs). Extend as needed. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = [
    'audit_logs', 'payments', 'invoices', 'service_reports', 'reviews',
    'booking_status_history', 'technician_assignments', 'bookings',
    'subscriptions', 'coupon_usages', 'coupons', 'addresses',
    'technician_profiles', 'customer_profiles', 'refresh_tokens', 'users',
    'service_packages', 'services', 'pest_categories',
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}
