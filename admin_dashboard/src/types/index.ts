// src/types/index.ts
// Shared API + auth types. JSON is snake_case (matches the backend); we keep wire shapes
// snake_case in DTOs and map at the edges where helpful.

// ---- API envelope ----
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}

/** Normalized error thrown by the api client. */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  requestId?: string;
  constructor(params: { code: string; message: string; status: number; details?: unknown; requestId?: string }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.requestId = params.requestId;
  }
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

// ---- Auth ----
export type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS_MANAGER' | 'DISPATCHER' | 'CUSTOMER_SUPPORT';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  /** Backend may return a top-level role ("Admin") plus an admin sub-role, or the sub-role
   * directly. The resolver in features/auth/permissions normalizes this. */
  role: string;
  admin_role?: AdminRole;
  /** Optional fine-grained permissions from the backend role_permissions model. When
   * present these take precedence over the static role→permission matrix. */
  permissions?: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
