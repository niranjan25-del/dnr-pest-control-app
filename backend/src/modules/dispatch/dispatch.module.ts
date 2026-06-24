import { Module } from "@nestjs/common";
import { TechnicianAssignmentModule } from "../technician-assignment/technician-assignment.module";
import { DispatchController } from "./dispatch.controller";

@Module({
  imports: [TechnicianAssignmentModule],
  controllers: [DispatchController],
})
export class DispatchModule {}
