// src/modules/promotions/promotions/promotions.module.ts
import { Module } from "@nestjs/common";
import { CouponsModule } from "../coupons/coupons.module";
import { PromotionsController } from "./promotions.controller";
import { PromotionsService } from "./promotions.service";

@Module({
  imports: [CouponsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}
