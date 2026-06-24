// src/modules/notifications/fcm.service.ts
//
// Firebase Cloud Messaging delivery. Reuses the firebase-admin app initialized by Step 3's
// FirebaseService (via the default app) and only guard-initializes if none exists, so there's
// no double-init. Sends to single tokens, batches of tokens (multicast), and topics. Identifies
// permanently-invalid tokens so the dispatcher can prune them. Degrades gracefully to a no-op
// when Firebase isn't configured (local/dev), logging instead of throwing.

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import {
  FCM_MAX_ATTEMPTS,
  FCM_MULTICAST_BATCH,
  FCM_RETRY_DELAY_MS,
  INVALID_TOKEN_ERRORS,
} from "./enums";
import { NotificationPayload, PushResult } from "./interfaces";

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private enabled = true;

  constructor(private readonly config: ConfigService) {}

  private messaging(): admin.messaging.Messaging | null {
    if (!this.enabled) return null;
    if (!admin.apps.length) {
      const projectId = this.config.get<string>("firebase.projectId");
      const clientEmail = this.config.get<string>("firebase.clientEmail");
      let privateKey = this.config.get<string>("firebase.privateKey");
      if (!projectId || !clientEmail || !privateKey) {
        this.enabled = false;
        this.logger.warn(
          "Firebase not configured — push notifications disabled (in-app still works)",
        );
        return null;
      }
      privateKey = privateKey.replace(/\\n/g, "\n");
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    return admin.messaging();
  }

  private toMessageData(
    data?: Record<string, unknown>,
  ): Record<string, string> {
    // FCM data values must be strings.
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {}))
      out[k] = typeof v === "string" ? v : JSON.stringify(v);
    return out;
  }

  async sendToTokens(
    tokens: string[],
    payload: NotificationPayload,
  ): Promise<PushResult> {
    const result: PushResult = {
      attempted: tokens.length,
      succeeded: 0,
      failed: 0,
      invalidTokens: [],
    };
    const messaging = this.messaging();
    if (!messaging || tokens.length === 0) return result;

    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_BATCH) {
      const batch = tokens.slice(i, i + FCM_MULTICAST_BATCH);
      const res = await this.withRetry(() =>
        messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: this.toMessageData(payload.data),
        }),
      );
      if (!res) {
        result.failed += batch.length;
        continue;
      }
      res.responses.forEach((r, idx) => {
        if (r.success) result.succeeded++;
        else {
          result.failed++;
          if (r.error && INVALID_TOKEN_ERRORS.has(r.error.code))
            result.invalidTokens.push(batch[idx]);
        }
      });
    }
    return result;
  }

  async sendToTopic(
    topic: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    const messaging = this.messaging();
    if (!messaging) return false;
    const res = await this.withRetry(() =>
      messaging.send({
        topic,
        notification: { title: payload.title, body: payload.body },
        data: this.toMessageData(payload.data),
      }),
    );
    return Boolean(res);
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T | null> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= FCM_MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < FCM_MAX_ATTEMPTS)
          await new Promise((r) => setTimeout(r, FCM_RETRY_DELAY_MS * attempt));
      }
    }
    this.logger.error(
      `FCM send failed after ${FCM_MAX_ATTEMPTS} attempts: ${(lastErr as Error)?.message}`,
    );
    return null;
  }
}
