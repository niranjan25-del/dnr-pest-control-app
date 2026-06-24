// src/modules/users/users.module.ts
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminTechniciansController } from "./admin-technicians.controller";
import { AdminCustomersController } from "./admin-customers.controller";
import { UsersService } from "./users.service";
import { AttendanceModule } from "../attendance/attendance.module";

@Module({
  imports: [AttendanceModule],
  controllers: [
    UsersController,
    AdminUsersController,
    AdminTechniciansController,
    AdminCustomersController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
