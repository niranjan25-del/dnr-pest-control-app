// src/modules/subscriptions/subscriptions.module.ts
import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RenewalService } from './renewal.service';
import { RecurringBookingService } from './recurring-booking.service';
import { CashfreeSubscriptionService } from './cashfree-subscription.service';

@Module({
  imports: [PlansModule, PaymentsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, RenewalService, RecurringBookingService, CashfreeSubscriptionService],
  exports: [SubscriptionsService, RenewalService],
})
export class SubscriptionsModule {}
