// src/modules/media/cloudfront.service.ts
//
// CloudFront delivery. When a CloudFront key-pair is configured, mints SIGNED, expiring CDN
// URLs for private objects (preferred — CDN-cached, low latency). Otherwise reports unavailable
// so MediaService falls back to S3 presigned GETs.
//
// ⚠ CONFIG (flagged): signed CloudFront URLs require CLOUDFRONT_KEY_PAIR_ID and
// CLOUDFRONT_PRIVATE_KEY (PEM). These aren't in the base env schema — they're read directly
// here and should be added to env validation. Without them, signing is disabled (S3 presign is
// used instead). The CloudFront distribution must front the private bucket via OAC.

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

@Injectable()
export class CloudFrontService {
  private readonly logger = new Logger(CloudFrontService.name);
  private readonly domain?: string;
  private readonly keyPairId?: string;
  private readonly privateKey?: string;

  constructor(private readonly config: ConfigService) {
    this.domain = this.config.get<string>("aws.cloudfrontDomain");
    this.keyPairId = this.config.get<string>("CLOUDFRONT_KEY_PAIR_ID");
    const pk = this.config.get<string>("CLOUDFRONT_PRIVATE_KEY");
    this.privateKey = pk ? pk.replace(/\\n/g, "\n") : undefined;
  }

  get signingEnabled(): boolean {
    return Boolean(this.domain && this.keyPairId && this.privateKey);
  }

  /** Public (unsigned) CDN URL — only for assets intentionally made public. */
  publicUrl(key: string): string | null {
    return this.domain ? `https://${this.domain}/${key}` : null;
  }

  /** Signed, expiring CDN URL for a private object; null if signing isn't configured. */
  signedUrl(key: string, expiresInSeconds: number): string | null {
    if (!this.signingEnabled) return null;
    try {
      return getSignedUrl({
        url: `https://${this.domain}/${key}`,
        keyPairId: this.keyPairId!,
        privateKey: this.privateKey!,
        dateLessThan: new Date(
          Date.now() + expiresInSeconds * 1000,
        ).toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `CloudFront signing failed for ${key}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
