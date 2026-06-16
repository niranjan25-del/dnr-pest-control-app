// src/main.ts
//
// Application bootstrap. Establishes the production edge controls that the security audit
// flagged as required:
//   • rawBody: true        → preserves the raw payload so Stripe webhook signature
//                            verification works (constructEvent needs the unparsed body)
//   • Helmet               → secure HTTP headers (HSTS, etc.)
//   • CORS allow-list      → only configured origins (admin dashboard + app)
//   • global prefix + URI versioning  → /api/v1/...
//   • structured logger    → nestjs-pino as the app logger
//   • graceful shutdown    → clean Prisma disconnect / connection drain
// (Global ValidationPipe, exception filter, and throttler guard are registered in AppModule
//  via APP_* providers so they participate in DI and are unit-testable.)

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,      // required for Stripe webhook signature verification
    bufferLogs: true,   // buffer until the pino logger is attached
  });

  const config = app.get(ConfigService);

  // Structured logging as the app-wide logger.
  app.useLogger(app.get(Logger));

  // Security headers.
  app.use(helmet());

  // CORS allow-list (no wildcard with credentials).
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins') ?? [],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  });

  // Routing: /api/v1/... with URI versioning (health is version-neutral).
  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? 'api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.get<string>('app.apiVersion') ?? '1',
  });

  // Graceful shutdown (drains connections, triggers Prisma onModuleDestroy).
  app.enableShutdownHooks();

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`DNR backend listening on :${port} (${config.get('app.env')})`);
}

bootstrap();
