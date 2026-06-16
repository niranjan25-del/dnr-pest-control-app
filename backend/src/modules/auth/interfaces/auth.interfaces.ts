// src/modules/auth/interfaces/auth.interfaces.ts
//
// Shared shapes for tokens, the JWT payload, the request-bound authenticated user, and the
// auth response returned to clients (snake_case token keys to match the API contract).

import { AdminRole, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: UserRole;
  adminRole?: AdminRole | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  adminRole?: AdminRole | null;
  permissions: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // access token TTL in seconds
}

export interface PublicUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  admin_role: AdminRole | null;
  status: string;
  email_verified: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
