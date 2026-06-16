// src/utils/format.ts
// Shared formatting. Money defaults to INR (₹) per the platform. Backend returns money as
// decimal strings, so we parse defensively.

import { format as formatDate, parseISO } from 'date-fns';

export function formatMoney(amount: string | number | null | undefined, currency = 'INR'): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number.isFinite(value) ? (value as number) : 0);
}

export function formatDateTime(iso: string | null | undefined, pattern = 'dd MMM yyyy, h:mm a'): string {
  if (!iso) return '—';
  try {
    return formatDate(parseISO(iso), pattern);
  } catch {
    return '—';
  }
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
