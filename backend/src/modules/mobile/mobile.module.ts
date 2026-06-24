// src/modules/mobile/mobile.module.ts
//
// Aggregates the mobile-specific controller surfaces. Imports only what each controller
// needs; no circular dependency because none of the imported modules import MobileModule.
// NestJS deduplicates BookingsModule even though TechnicianAssignmentModule also imports it.
//
//   CustomersController      → ProfilesModule, AddressesModule, UsersModule
//   TechniciansController    → ProfilesModule, TechnicianAssignmentModule, BookingsModule, LocationModule
//   BookingActionsController → TechnicianAssignmentModule, ServiceReportsModule, LocationModule (+ global PrismaService)
//   FilesController          → MediaModule (POST /files mobile alias for POST /media/upload)

import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { AddressesModule } from "../addresses/addresses.module";
import { UsersModule } from "../users/users.module";
import { BookingsModule } from "../bookings/bookings.module";
import { TechnicianAssignmentModule } from "../technician-assignment/technician-assignment.module";
import { LocationModule } from "../location/location.module";
import { ServiceReportsModule } from "../service-reports/service-reports.module";
import { MediaModule } from "../media/media.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { CustomersController } from "./customers.controller";
import { TechniciansController } from "./technicians.controller";
import { BookingActionsController } from "./booking-actions.controller";
import { FilesController } from "./files.controller";

@Module({
  imports: [
    ProfilesModule,
    AddressesModule,
    UsersModule,
    BookingsModule,
    TechnicianAssignmentModule,
    LocationModule,
    ServiceReportsModule,
    MediaModule,
    AttendanceModule,
  ],
  controllers: [
    CustomersController,
    TechniciansController,
    BookingActionsController,
    FilesController,
  ],
})
export class MobileModule {}
