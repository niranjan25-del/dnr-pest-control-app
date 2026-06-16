// src/modules/promotions/coupons/coupons.module.ts
//
// Exports CouponsService so the promotions layer (which has no model of its own) delegates
// campaign management to coupons.

import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponValidationService } from './coupon-validation.service';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService, CouponValidationService],
  exports: [CouponsService],
})
export class CouponsModule {}
