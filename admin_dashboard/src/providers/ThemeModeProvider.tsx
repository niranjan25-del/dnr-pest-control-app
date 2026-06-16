// src/providers/ThemeModeProvider.tsx
// Owns the light/dark mode (persisted to localStorage, defaulting to the OS preference) and
// supplies the built MUI theme. Exposes a context so the UI can toggle mode.

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createAppTheme } from '@/theme/theme';

type Mode = 'light' | 'dark';
const STORAGE_KEY = 'dnr_admin_theme_mode';

export interface ColorModeContextValue {
  mode: Mode;
  toggle: () => void;
  setMode: (m: Mode) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function initialMode(): Mode {
  const stored = localStorage.getItem(STORAGE_KEY) as Mode | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const toggle = useCallback(() => setModeState((m) => (m === 'light' ? 'dark' : 'light')), []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo<ColorModeContextValue>(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
