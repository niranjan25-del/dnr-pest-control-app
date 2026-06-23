// src/services/authService.ts
// Auth API calls for the admin (staff) login path: email + password → app JWTs.
//
// FLAG: the mobile clients exchange a firebase_id_token at POST /auth/login; admins use the
// staff email/password path the Auth Design references ("first login prompts password set
// (if staff direct path)"). Confirm the backend accepts {email, password} on /auth/login
// for staff, or expose a dedicated staff login endpoint and update the URL here.

import { apiClient } from './apiClient';
import { tokenStorage } from '@/utils/storage';
import type { AuthUser, LoginResponse } from '@/types';

export const authService = {
  async register(payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<AuthUser> {
    const { data } = await apiClient.post<LoginResponse>('/auth/register', {
      ...payload,
      role: 'CUSTOMER',
    });
    tokenStorage.set({ access_token: data.access_token, refresh_token: data.refresh_token });
    return data.user;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    const user = data.user;
    tokenStorage.set({ access_token: data.access_token, refresh_token: data.refresh_token });
    return user;
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser | { data: AuthUser }>('/auth/me');
    return (data as { data?: AuthUser }).data ?? (data as AuthUser);
  },

  async logout(): Promise<void> {
    const refresh_token = tokenStorage.refresh;
    try {
      if (refresh_token) await apiClient.post('/auth/logout', { refresh_token });
    } finally {
      tokenStorage.clear();
    }
  },
};
