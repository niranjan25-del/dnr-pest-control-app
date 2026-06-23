// src/providers/AuthProvider.tsx
// Holds the authenticated admin user + session status, and exposes login/logout. On mount
// it restores the session (if a token exists, fetch /auth/me). Listens for the api client's
// forced-logout event (refresh failed) and clears state so routing falls back to /login.

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@/services/authService';
import { AUTH_LOGOUT_EVENT } from '@/services/apiClient';
import { tokenStorage } from '@/utils/storage';
import type { AuthUser } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) => Promise<AuthUser>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Restore session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStorage.hasSession) {
        if (active) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await authService.me();
        if (active) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        tokenStorage.clear();
        if (active) setStatus('unauthenticated');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Forced logout from the api client (refresh failed).
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handler);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handler);
  }, []);

  const register = useCallback(async (
    payload: { email: string; password: string; fullName: string; phone?: string },
  ): Promise<AuthUser> => {
    const u = await authService.register(payload);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const u = await authService.login(email, password);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, status, register, login, logout }), [user, status, register, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
