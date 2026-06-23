// src/app.module.ts
//
// Composition root. Wires:
//   • ConfigModule (global) with fail-fast env validation + namespaced config
//   • LoggerModule (nestjs-pino) — structured JSON request logging, with auth/token redaction
//   • ThrottlerModule + global guard — baseline rate limiting (OWASP API4/API6)
//   • PrismaModule (global)
//   • Global ValidationPipe + global AllExceptionsFilter via APP_* providers (DI-friendly)
//   • RequestContextMiddleware for request-id propagation
//   • Feature modules (HealthModule now; auth/users/bookings/... attach here next)

import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { configurations } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { FirebaseModule } from './infrastructure/firebase/firebase.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ServicesModule } from './modules/services/services.module';
import { PestCategoriesModule } from './modules/pest-categories/pest-categories.module';
import { ServicePackagesModule } from './modules/service-packages/service-packages.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { TechnicianAssignmentModule } from './modules/technician-assignment/technician-assignment.module';
import { ServiceAreasModule } from './modules/service-areas/service-areas.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CouponsModule } from './modules/promotions/coupons/coupons.module';
import { PromotionsModule } from './modules/promotions/promotions/promotions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { MediaModule } from './modules/media/media.module';
import { LocationModule } from './modules/location/location.module';
import { ServiceReportsModule } from './modules/service-reports/service-reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AuditModule } from './modules/audit/audit.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { WarrantiesModule } from './modules/warranties/warranties.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel') ?? 'info',
          transport:
            config.get<string>('app.env') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Correlate logs with the error envelope's request_id.
          customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
          // Never log secrets/PII.
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.token'],
            remove: true,
          },
          autoLogging: true,
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('app.throttleTtlSeconds') ?? 60) * 1000,
          limit: config.get<number>('app.throttleLimit') ?? 120,
        },
      ],
    }),

    PrismaModule,
    FirebaseModule,

    // --- Feature modules ---
    HealthModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    ServicesModule,
    PestCategoriesModule,
    ServicePackagesModule,
    BookingsModule,
    TechnicianAssignmentModule,
    ServiceAreasModule,
    AddressesModule,
    PaymentsModule,
    InvoicesModule,
    PlansModule,
    SubscriptionsModule,
    CouponsModule,
    PromotionsModule,
    NotificationsModule,
    ChatModule,
    MediaModule,
    LocationModule,
    ServiceReportsModule,
    AnalyticsModule,
    DispatchModule,
    ReviewsModule,
    AuditModule,
    MobileModule,
    WarrantiesModule,
  ],
  providers: [
    // Global rate limiting.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global validation: strip unknown props, reject extras, coerce types.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    // Global error envelope.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
