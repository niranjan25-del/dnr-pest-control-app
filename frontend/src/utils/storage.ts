// src/utils/storage.ts
// Token persistence. Kept in one place so the storage mechanism can change (e.g. to
// httpOnly cookies) without touching call sites.
//
// SECURITY NOTE: localStorage is convenient but XSS-exposed. For higher security, move
// refresh tokens to httpOnly cookies set by the backend and keep only the short-lived
// access token in memory. The interface below makes that swap localized.

const ACCESS_KEY = 'dnr_admin_access_token';
const REFRESH_KEY = 'dnr_admin_refresh_token';

export const tokenStorage = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { access_token: string; refresh_token?: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  get hasSession(): boolean {
    return Boolean(localStorage.getItem(ACCESS_KEY));
  },
};
