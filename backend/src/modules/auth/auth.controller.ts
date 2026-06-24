// src/modules/auth/auth.controller.ts
//
// Auth endpoints under /api/v1/auth. Public routes are explicit; /me, /logout, and
// /change-password require a valid access token (JwtAuthGuard). Throttling is provided by
// the global ThrottlerGuard; tighten auth-route limits with @Throttle() as needed.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import {
  ChangePasswordDto,
  FirebaseLoginDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthenticatedUser } from "./interfaces/auth.interfaces";
import { FirebaseIdentity } from "src/infrastructure/firebase/firebase.service";
import { CurrentUser as Identity } from "./decorators";

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // stricter than global on credentials
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto.refresh_token);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refresh_token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Identity("id") userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(userId, dto);
  }

  // Verifies the Firebase ID token (FirebaseAuthGuard) → issues app JWTs. Covers email,
  // Google, and Apple sign-in (all flow through Firebase on the client).
  @Public()
  @UseGuards(FirebaseAuthGuard)
  @Post("firebase-login")
  @HttpCode(HttpStatus.OK)
  firebaseLogin(
    @CurrentUser() identity: FirebaseIdentity,
    @Body() dto: FirebaseLoginDto,
  ) {
    return this.auth.firebaseLogin(identity, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Identity() user: AuthenticatedUser) {
    return this.auth.getCurrentUser(user.id);
  }
}
