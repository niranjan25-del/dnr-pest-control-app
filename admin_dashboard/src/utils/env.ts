// src/utils/env.ts
// Typed, validated access to Vite env vars. Fails fast in dev if a required var is missing.

interface AppEnv {
  apiBaseUrl: string;
  appName: string;
  env: 'development' | 'staging' | 'production';
}

function required(key: string, value: string | undefined): string {
  if (!value) {
    // Surface misconfiguration early rather than failing on first request.
    console.error(`[env] Missing required env var: ${key}`);
    return '';
  }
  return value;
}

export const env: AppEnv = {
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  appName: import.meta.env.VITE_APP_NAME ?? 'DNR Admin',
  env: (import.meta.env.VITE_ENV as AppEnv['env']) ?? 'development',
};

export const isProd = env.env === 'production';
