// src/modules/payments/webhook.controller.ts
//
// POST /payments/webhooks/cashfree — Cashfree's server-to-server callback. PUBLIC (no JWT),
// authenticated via Cashfree's HMAC-SHA256 signature on the raw body. Always returns 200
// quickly so Cashfree doesn't retry; signature failures return 400.
// Requires rawBody:true in NestJS bootstrap (already set in main.ts).

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import { RawBodyRequest } from "@nestjs/common";
import { Request } from "express";
import { Public } from "../auth/decorators";
import { PaymentsService } from "./payments.service";
import { CashfreeService } from "./cashfree.service";

@Controller({ path: "payments/webhooks", version: "1" })
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly cashfree: CashfreeService,
  ) {}

  @Public()
  @Post("cashfree")
  @HttpCode(200)
  async handleCashfree(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-webhook-signature") signature: string,
    @Headers("x-webhook-timestamp") timestamp: string,
  ) {
    if (!signature || !timestamp || !req.rawBody) {
      throw new BadRequestException({
        code: "INVALID_WEBHOOK",
        message: "Missing signature, timestamp, or body",
      });
    }

    const rawBodyStr = req.rawBody.toString("utf8");
    try {
      this.cashfree.verifyWebhookSignature(signature, rawBodyStr, timestamp);
    } catch (err) {
      this.logger.warn(
        `Cashfree webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new BadRequestException({
        code: "INVALID_WEBHOOK",
        message: "Signature verification failed",
      });
    }

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = JSON.parse(rawBodyStr);
    } catch {
      throw new BadRequestException({
        code: "INVALID_WEBHOOK",
        message: "Invalid JSON body",
      });
    }

    try {
      await this.payments.handleWebhookEvent(event);
    } catch (err) {
      // Log + still return 200 so Cashfree doesn't retry on transient errors.
      this.logger.error(
        `Error handling Cashfree event ${event.type}: ${(err as Error).message}`,
      );
    }
    return { received: true };
  }
}
