// src/modules/auth/dto/index.ts
//
// Request DTOs with class-validator rules + explicit messages. The global ValidationPipe
// (whitelist + forbidNonWhitelisted) strips/rejects unknown fields — so, e.g., a client
// cannot inject `role: ADMIN` unless it's a declared field (and RegisterDto restricts it).

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

// Self-registration is limited to CUSTOMER/TECHNICIAN; ADMIN is provisioned internally.
export enum SelfRegisterRole {
  CUSTOMER = "CUSTOMER",
  TECHNICIAN = "TECHNICIAN",
}

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export class RegisterDto {
  @IsEmail({}, { message: "A valid email is required" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" }) // bcrypt limit
  @Matches(PASSWORD_RULE, {
    message: "Password must contain letters and numbers",
  })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "Full name is required" })
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: "Phone must be a valid international number",
  })
  phone?: string;

  @IsOptional()
  @IsEnum(SelfRegisterRole, { message: "Role must be CUSTOMER or TECHNICIAN" })
  role?: SelfRegisterRole;
}

export class LoginDto {
  @IsEmail({}, { message: "A valid email is required" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: "refresh_token is required" })
  refresh_token!: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: "A valid email is required" })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: "Reset token is required" })
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, {
    message: "Password must contain letters and numbers",
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: "Current password is required" })
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, {
    message: "Password must contain letters and numbers",
  })
  newPassword!: string;
}

export class FirebaseLoginDto {
  @IsString()
  @IsNotEmpty({ message: "Firebase ID token is required" })
  idToken!: string;

  // Optional client hint for first-time provisioning (e.g. provider = google.com / apple.com).
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(SelfRegisterRole, { message: "Role must be CUSTOMER or TECHNICIAN" })
  role?: SelfRegisterRole;
}
