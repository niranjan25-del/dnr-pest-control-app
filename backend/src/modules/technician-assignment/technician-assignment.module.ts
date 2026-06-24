// src/modules/technician-assignment/technician-assignment.module.ts
//
// Imports BookingsModule to reuse BookingStatusService (accepting an assignment confirms the
// booking). Bundles the engine, workload, and availability services.

import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { TechnicianAssignmentController } from "./technician-assignment.controller";
import { TechnicianAssignmentService } from "./technician-assignment.service";
import { AssignmentEngineService } from "./assignment-engine.service";
import { WorkloadService } from "./workload.service";
import { TechnicianAvailabilityService } from "./availability.service";

@Module({
  imports: [BookingsModule],
  controllers: [TechnicianAssignmentController],
  providers: [
    TechnicianAssignmentService,
    AssignmentEngineService,
    WorkloadService,
    TechnicianAvailabilityService,
  ],
  exports: [
    TechnicianAssignmentService,
    AssignmentEngineService,
    WorkloadService,
  ],
})
export class TechnicianAssignmentModule {}
