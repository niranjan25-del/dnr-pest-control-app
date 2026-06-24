// src/modules/bookings/bookings.module.ts
import { Module } from "@nestjs/common";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { BookingStatusService } from "./booking-status.service";
import { AvailabilityService } from "./availability.service";
import { ServiceAreasModule } from "../service-areas/service-areas.module";

@Module({
  imports: [ServiceAreasModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStatusService, AvailabilityService],
  // Exported so the dispatch/assignment module (Step 7) can reuse the status machine.
  exports: [BookingsService, BookingStatusService, AvailabilityService],
})
export class BookingsModule {}
