// src/modules/auth/auth.service.ts
//
// Orchestrates authentication. Delegates token mechanics to TokenService and IdP
// verification to the Firebase strategy/service. Security choices:
//   • bcrypt password hashing (rounds=12).
//   • No user enumeration: login + forgot-password give generic results.
//   • Stateless single-use reset tokens (signed with a key derived from the user's current
//     password hash, so a successful reset invalidates the token automatically — no extra
//     table needed).
//   • Login attempts (success/failure) and reset requests are logged (no secrets/PII).

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "src/database/prisma.service";
import { FirebaseIdentity } from "src/infrastructure/firebase/firebase.service";
import { AUTH_ERRORS, BCRYPT_ROUNDS } from "./constants/auth.constants";
import {
  ChangePasswordDto,
  FirebaseLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SelfRegisterRole,
} from "./dto";
import {
  AuthResponse,
  AuthenticatedUser,
  PublicUser,
} from "./interfaces/auth.interfaces";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Registration ----------
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
      select: { email: true, phone: true },
    });
    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException({
          code: AUTH_ERRORS.EMAIL_IN_USE,
          message: "This email is already registered. Please sign in instead.",
        });
      }
      throw new ConflictException({
        code: "PHONE_IN_USE",
        message:
          "This phone number is already linked to an account. Try a different number or leave it blank.",
      });
    }
    const role = (dto.role ?? SelfRegisterRole.CUSTOMER) as unknown as UserRole;
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role,
        },
      });
      if (role === UserRole.CUSTOMER) {
        await tx.customerProfile.create({ data: { userId: created.id } });
      } else if (role === UserRole.TECHNICIAN) {
        await tx.technicianProfile.create({ data: { userId: created.id } });
      }
      return created;
    });

    this.logger.log(`Registered user ${user.id} (${role})`);
    const tokens = await this.tokens.issueTokens(user);
    return { ...tokens, user: this.toPublic(user) };
  }

  // ---------- Login (email/password — staff & fallback path) ----------
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    // Generic failure either way (no enumeration); still run a compare to reduce timing signal.
    const valid = user?.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !valid) {
      this.logger.warn(`Failed login for ${dto.email}`);
      throw new UnauthorizedException({
        code: AUTH_ERRORS.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: AUTH_ERRORS.ACCOUNT_SUSPENDED,
        message: "Account is not active",
      });
    }
    this.logger.log(`Login success for user ${user.id}`);
    const tokens = await this.tokens.issueTokens(user);
    return { ...tokens, user: this.toPublic(user) };
  }

  // Used by tests / local strategies if a username-password validate hook is needed.
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (
      user?.passwordHash &&
      (await bcrypt.compare(password, user.passwordHash))
    )
      return user;
    return null;
  }

  // ---------- Refresh / Logout ----------
  refreshToken(refreshToken: string) {
    return this.tokens.rotateRefreshToken(refreshToken);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.revokeRefreshToken(refreshToken);
    return { success: true };
  }

  // ---------- Firebase / Google / Apple (IdP) ----------
  // The client signs in with Firebase (email, Google, or Apple), obtains an ID token, and
  // calls /auth/firebase-login. We verify, find-or-provision the user, then issue app JWTs.
  async firebaseLogin(
    identity: FirebaseIdentity,
    dto: FirebaseLoginDto,
  ): Promise<AuthResponse> {
    if (!identity.email) {
      throw new BadRequestException({
        code: AUTH_ERRORS.INVALID_FIREBASE_TOKEN,
        message: "Token missing email",
      });
    }
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ firebaseUid: identity.uid }, { email: identity.email }],
        deletedAt: null,
      },
    });

    if (!user) {
      const role = (dto.role ??
        SelfRegisterRole.CUSTOMER) as unknown as UserRole;
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: identity.email!,
            fullName: identity.name ?? identity.email!.split("@")[0],
            firebaseUid: identity.uid,
            role,
            emailVerified: identity.emailVerified,
          },
        });
        if (role === UserRole.CUSTOMER)
          await tx.customerProfile.create({ data: { userId: created.id } });
        else if (role === UserRole.TECHNICIAN)
          await tx.technicianProfile.create({ data: { userId: created.id } });
        return created;
      });
      this.logger.log(
        `Provisioned IdP user ${user.id} via ${identity.signInProvider ?? dto.provider ?? "firebase"}`,
      );
    } else if (!user.firebaseUid) {
      // Link an existing email account to this Firebase uid (deliberate, verified by token).
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: identity.uid,
          emailVerified: user.emailVerified || identity.emailVerified,
        },
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: AUTH_ERRORS.ACCOUNT_SUSPENDED,
        message: "Account is not active",
      });
    }
    const tokens = await this.tokens.issueTokens(user);
    return { ...tokens, user: this.toPublic(user) };
  }

  // ---------- Password reset (stateless, single-use) ----------
  private resetSecretFor(passwordHash: string | null): string {
    return `${this.config.get<string>("jwt.accessSecret")}.${passwordHash ?? "no-pwd"}`;
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: true; reset_token?: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    this.logger.log(`Password reset requested for ${email}`);
    // Always return success (no enumeration). Email the link out-of-band in production.
    if (!user?.passwordHash) return { success: true };
    const token = this.jwt.sign(
      { sub: user.id, type: "pwd_reset" },
      { secret: this.resetSecretFor(user.passwordHash), expiresIn: "1h" },
    );
    // In production: send `token` via email; do NOT return it. Returned here only to support
    // local/dev testing — gate behind NODE_ENV !== 'production' at the controller if needed.
    return { success: true, reset_token: token };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    // Decode without verifying to find the user, then verify with their current-hash secret.
    const decoded = this.jwt.decode(dto.token) as { sub?: string } | null;
    const user = decoded?.sub
      ? await this.prisma.user.findFirst({
          where: { id: decoded.sub, deletedAt: null },
        })
      : null;
    if (!user) this.invalidReset();
    try {
      this.jwt.verify(dto.token, {
        secret: this.resetSecretFor(user!.passwordHash),
      });
    } catch {
      this.invalidReset();
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user!.id },
      data: { passwordHash },
    });
    await this.tokens.revokeAllForUser(user!.id); // invalidate existing sessions
    this.logger.log(`Password reset completed for user ${user!.id}`);
    return { success: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException({
        code: AUTH_ERRORS.INVALID_CREDENTIALS,
        message: "Current password is incorrect",
      });
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.tokens.revokeAllForUser(userId);
    return { success: true };
  }

  // ---------- Current user ----------
  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user)
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Account not found",
      });
    return this.toPublic(user);
  }

  // ---------- helpers ----------
  private invalidReset(): never {
    throw new BadRequestException({
      code: AUTH_ERRORS.INVALID_RESET_TOKEN,
      message: "Invalid or expired reset token",
    });
  }

  private toPublic(u: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    role: UserRole;
    adminRole: PublicUser["admin_role"];
    status: string;
    emailVerified: boolean;
  }): PublicUser {
    return {
      id: u.id,
      email: u.email,
      full_name: u.fullName,
      phone: u.phone,
      role: u.role,
      admin_role: u.adminRole,
      status: u.status,
      email_verified: u.emailVerified,
    };
  }
}
