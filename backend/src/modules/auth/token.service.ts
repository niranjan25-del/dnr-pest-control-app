// src/modules/auth/token.service.ts
//
// Owns all token mechanics, separate from AuthService:
//   • Access token: short-lived JWT (issuer/audience pinned).
//   • Refresh token: opaque "<rowId>.<secret>" — only a bcrypt hash of the secret is stored;
//     rotated on every use (old row revoked). Presenting an already-revoked token triggers
//     reuse detection → revoke the whole family (theft response).

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { PrismaService } from "src/database/prisma.service";
import { BCRYPT_ROUNDS, AUTH_ERRORS } from "./constants/auth.constants";
import { AuthTokens, JwtPayload } from "./interfaces/auth.interfaces";

interface UserForToken {
  id: string;
  email: string;
  role: JwtPayload["role"];
  adminRole?: JwtPayload["adminRole"];
  status?: UserStatus;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private accessTtlSeconds(): number {
    const ttl = this.config.get<string>("jwt.accessTtl") ?? "15m";
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] ?? 60);
  }

  signAccessToken(user: UserForToken): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole ?? null,
    };
    return this.jwt.sign(payload); // secret/expiry/issuer/audience from JwtModule config
  }

  /** Create + persist a new refresh token; return the opaque value to hand the client. */
  async createRefreshToken(userId: string): Promise<string> {
    const secret = randomBytes(48).toString("hex");
    const tokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
    const days = this.config.get<number>("jwt.refreshTtlDays") ?? 30;
    const expiresAt = new Date(Date.now() + days * 86400_000);
    const row = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return `${row.id}.${secret}`;
  }

  async issueTokens(user: UserForToken): Promise<AuthTokens> {
    const [access_token, refresh_token] = await Promise.all([
      Promise.resolve(this.signAccessToken(user)),
      this.createRefreshToken(user.id),
    ]);
    return {
      access_token,
      refresh_token,
      token_type: "Bearer",
      expires_in: this.accessTtlSeconds(),
    };
  }

  /** Validate + rotate a refresh token; returns fresh tokens. */
  async rotateRefreshToken(opaque: string): Promise<AuthTokens> {
    const [rowId, secret] = opaque.split(".");
    if (!rowId || !secret) this.fail();

    const row = await this.prisma.refreshToken.findUnique({
      where: { id: rowId },
    });
    if (!row) this.fail();

    // Reuse detection: a revoked token presented again → assume theft, revoke the family.
    if (row!.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${row!.userId} — revoking all sessions`,
      );
      await this.revokeAllForUser(row!.userId);
      this.fail();
    }
    if (row!.expiresAt.getTime() < Date.now()) this.fail();

    const ok = await bcrypt.compare(secret, row!.tokenHash);
    if (!ok) this.fail();

    const user = await this.prisma.user.findFirst({
      where: { id: row!.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        status: true,
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) this.fail();

    // Rotate: revoke the presented token, mint a new pair.
    await this.prisma.refreshToken.update({
      where: { id: row!.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user!);
  }

  async revokeRefreshToken(opaque: string): Promise<void> {
    const [rowId] = opaque.split(".");
    if (!rowId) return;
    await this.prisma.refreshToken.updateMany({
      where: { id: rowId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private fail(): never {
    throw new UnauthorizedException({
      code: AUTH_ERRORS.INVALID_REFRESH_TOKEN,
      message: "Invalid or expired refresh token",
    });
  }
}
