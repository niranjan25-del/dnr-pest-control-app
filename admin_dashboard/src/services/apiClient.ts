// src/services/apiClient.ts
// Axios instance for the backend. Responsibilities:
//   • attach the access token on every request
//   • normalize the backend error envelope {error:{code,message,details,request_id}} → ApiError
//   • transparently refresh on 401 (single-flight; concurrent 401s queue behind one refresh)
//   • on refresh failure, clear the session and emit `auth:logout` for the AuthProvider
//
// Token refresh uses a bare axios call (not this instance) to avoid interceptor recursion.

import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/utils/env';
import { tokenStorage } from '@/utils/storage';
import { ApiError, type ApiErrorEnvelope, type AuthTokens } from '@/types';

/** Fired when the session can't be recovered; AuthProvider listens and routes to /login. */
export const AUTH_LOGOUT_EVENT = 'auth:logout';
function emitLogout() {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request: attach bearer token ----
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Single-flight refresh ----
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh_token = tokenStorage.refresh;
  if (!refresh_token) return null;
  try {
    const res = await axios.post<AuthTokens>(`${env.apiBaseUrl}/auth/refresh`, { refresh_token });
    tokenStorage.set(res.data);
    return res.data.access_token;
  } catch {
    return null;
  }
}

function toApiError(error: AxiosError<ApiErrorEnvelope>): ApiError {
  const status = error.response?.status ?? 0;
  const envelope = error.response?.data?.error;
  if (envelope) {
    return new ApiError({ code: envelope.code, message: envelope.message, status, details: envelope.details, requestId: envelope.request_id });
  }
  if (error.code === 'ECONNABORTED') return new ApiError({ code: 'TIMEOUT', message: 'The request timed out.', status });
  if (!error.response) return new ApiError({ code: 'NETWORK', message: 'Network error. Check your connection.', status });
  return new ApiError({ code: 'UNKNOWN', message: error.message || 'Something went wrong.', status });
}

// ---- Response: refresh-on-401 + error normalization ----
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      }
      tokenStorage.clear();
      emitLogout();
    }
    return Promise.reject(toApiError(error));
  },
);
