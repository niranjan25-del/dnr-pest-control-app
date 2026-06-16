// src/modules/auth/constants/auth.constants.ts
//
// Metadata keys for the RBAC decorators/guards and the canonical machine-readable error
// codes the auth module emits (surfaced in the error envelope's `code`).

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const IS_PUBLIC_KEY = 'isPublic';

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_FIREBASE_TOKEN: 'INVALID_FIREBASE_TOKEN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
} as const;

export const BCRYPT_ROUNDS = 12;
