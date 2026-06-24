// src/modules/services/services.module.ts
//
// Bundles Services + Service Categories (same catalog domain; categories management is part
// of the Services feature set). Pest categories and packages are their own modules.

import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";
import { ServiceCategoriesController } from "./service-categories.controller";
import { ServiceCategoriesService } from "./service-categories.service";

@Module({
  controllers: [ServicesController, ServiceCategoriesController],
  providers: [ServicesService, ServiceCategoriesService],
  exports: [ServicesService, ServiceCategoriesService],
})
export class ServicesModule {}
