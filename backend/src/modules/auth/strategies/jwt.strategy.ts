// src/modules/auth/strategies/jwt.strategy.ts
//
// Validates the access-token JWT (signature + issuer/audience), then loads the user to
// confirm it still exists and is ACTIVE — so a suspended/deleted account is rejected even
// while a short-lived token is technically unexpired. Returns the AuthenticatedUser that
// guards/@CurrentUser consume.

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserStatus } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUser, JwtPayload } from "../interfaces/auth.interfaces";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret")!,
      issuer: config.get<string>("jwt.issuer"),
      audience: config.get<string>("jwt.audience"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        permissions: true,
        status: true,
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Account is not active",
      });
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole,
      permissions: user.permissions,
    };
  }
}
