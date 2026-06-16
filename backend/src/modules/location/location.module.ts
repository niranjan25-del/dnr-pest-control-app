// src/modules/location/location.module.ts
//
// Wires the location REST + WebSocket surfaces. Imports BookingsModule (BookingStatusService
// for check-in/out transitions) and NotificationsModule (arrival/completion push). Registers
// its own JwtModule so the gateway can verify socket tokens. The LocationService ↔ Location
// gateway cycle is resolved with forwardRef.
//
// SCALING: see chat.module for the Socket.IO Redis adapter wiring (apply the same adapter in
// main.ts) and move TrackingService state to Redis for multi-instance correctness.

import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { TrackingService } from './tracking.service';
import { RouteService } from './route.service';
import { GeofenceService } from './geofence.service';
import { EtaService } from './eta.service';

@Module({
  imports: [
    BookingsModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('jwt.accessSecret') }),
    }),
  ],
  controllers: [LocationController],
  providers: [LocationGateway, LocationService, TrackingService, RouteService, GeofenceService, EtaService],
  exports: [LocationService, TrackingService],
})
export class LocationModule {}
