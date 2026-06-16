// src/modules/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhook.controller';
import { PaymentsService } from './payments.service';
import { CashfreeService } from './cashfree.service';

@Module({
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, CashfreeService],
  exports: [PaymentsService, CashfreeService],
})
export class PaymentsModule {}
