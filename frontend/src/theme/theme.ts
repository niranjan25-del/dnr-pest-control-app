// src/theme/theme.ts
// MUI theme built from the platform design system: brand green #1E8E5A, neutral blue
// secondary, Inter type, 8-pt spacing, default radius 12. Light + dark palettes use the
// documented tokens so the dashboard matches the mobile apps.

import { createTheme, type ThemeOptions } from '@mui/material/styles';

const brand = {
  50: '#E8F5EE', 100: '#C5E7D4', 200: '#9FD8B8', 300: '#79C99C', 400: '#4FB87F',
  500: '#1E8E5A', 600: '#197C4F', 700: '#136540', 800: '#0D4E31', 900: '#083420',
};
const accent = { 500: '#F5A623' };

const shared: ThemeOptions = {
  shape: { borderRadius: 12 },
  spacing: 8,
  typography: {
    fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.5rem', fontWeight: 700 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } }, defaultProps: { elevation: 0, variant: 'outlined' } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
};

export function createAppTheme(mode: 'light' | 'dark') {
  const isLight = mode === 'light';
  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: isLight ? brand[500] : '#3FB47C', dark: brand[700], light: brand[300], contrastText: '#FFFFFF' },
      secondary: { main: isLight ? '#2F4B6E' : '#7E94AC' },
      warning: { main: isLight ? '#E8A317' : '#F0B43C' },
      error: { main: isLight ? '#D64545' : '#EA6A6A' },
      success: { main: isLight ? '#2BA84A' : '#43C063' },
      info: { main: isLight ? '#2D7DD2' : '#5AA0E0' },
      background: isLight
        ? { default: '#F7F9FA', paper: '#FFFFFF' }
        : { default: '#0E1419', paper: '#161D24' },
      divider: isLight ? '#DDE3E8' : '#2C3742',
      text: isLight
        ? { primary: '#2A323B', secondary: '#5C6873' }
        : { primary: '#EAEEF1', secondary: '#9DAAB6' },
    },
  });
}

export const BRAND = brand;
export const ACCENT = accent;
