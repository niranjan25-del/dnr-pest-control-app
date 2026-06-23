// src/providers/ToastProvider.tsx
//
// App-wide toast / system-alert framework (the spec's "Toast notifications" + "System
// alerts"). Provides a queued MUI Snackbar+Alert and a `useToast()` hook so any feature
// can surface success/error/info/warning feedback after a mutation. Sits inside the theme
// provider so it inherits light/dark. One toast shows at a time; the rest queue.
//
// Usage:
//   const toast = useToast();
//   toast.success('Booking confirmed');
//   toast.error(err instanceof ApiError ? err.message : 'Something went wrong');

import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastMessage {
  key: number;
  message: string;
  severity: AlertColor;
  duration: number;
}

interface ToastApi {
  show: (message: string, severity?: AlertColor, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [, setQueue] = useState<ToastMessage[]>([]);
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [open, setOpen] = useState(false);
  const keyRef = useRef(0);

  // Promote the next queued message when none is showing.
  const pump = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) return q;
      const [next, ...rest] = q;
      setCurrent(next);
      setOpen(true);
      return rest;
    });
  }, []);

  const show = useCallback(
    (message: string, severity: AlertColor = 'info', duration = 4000) => {
      keyRef.current += 1;
      const msg: ToastMessage = { key: keyRef.current, message, severity, duration };
      setCurrent((cur) => {
        if (cur === null) {
          // Nothing showing: display immediately.
          setOpen(true);
          return msg;
        }
        // Something showing: enqueue.
        setQueue((q) => [...q, msg]);
        return cur;
      });
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, d) => show(m, 'success', d),
      error: (m, d) => show(m, 'error', d ?? 6000),
      info: (m, d) => show(m, 'info', d),
      warning: (m, d) => show(m, 'warning', d),
    }),
    [show],
  );

  const handleClose = (_e?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  // After the exit transition, clear current and pump the next.
  const handleExited = () => {
    setCurrent(null);
    pump();
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current?.duration ?? 4000}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {current ? (
          <Alert onClose={handleClose} severity={current.severity} variant="filled" sx={{ width: '100%' }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
