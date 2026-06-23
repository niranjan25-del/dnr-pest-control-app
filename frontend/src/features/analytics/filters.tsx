// src/features/analytics/filters.tsx
// Shared analytics filters: date range (with presets), granularity, and optional service /
// technician / region scopes — all synced to the URL so a filtered view is shareable. The
// `useAnalyticsFilters` hook returns the normalized AnalyticsFilters object the hooks need.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, subDays, subMonths } from 'date-fns';
import type { AnalyticsFilters, Granularity } from './types';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

function defaults(): { from: string; to: string } {
  const now = new Date();
  return { from: iso(subMonths(now, 12)), to: iso(now) };
}

export function useAnalyticsFilters() {
  const [params, setParams] = useSearchParams();
  const def = defaults();

  const filters: AnalyticsFilters = useMemo(
    () => ({
      from: params.get('from') ?? def.from,
      to: params.get('to') ?? def.to,
      granularity: (params.get('granularity') as Granularity) ?? 'MONTH',
      service_id: params.get('service_id') ?? undefined,
      technician_id: params.get('technician_id') ?? undefined,
      region: params.get('region') ?? undefined,
    }),
    [params, def.from, def.to],
  );

  const patch = (next: Record<string, string | undefined>) =>
    setParams((prev) => {
      const sp = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(next)) {
        if (!v) sp.delete(k);
        else sp.set(k, v);
      }
      return sp;
    });

  const setPreset = (days?: number, months?: number) => {
    const now = new Date();
    const from = months ? subMonths(now, months) : subDays(now, days ?? 30);
    patch({ from: iso(from), to: iso(now) });
  };

  return { filters, patch, setPreset };
}

export function AnalyticsFiltersBar() {
  const { filters, patch, setPreset } = useAnalyticsFilters();

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 3 }} alignItems={{ lg: 'center' }}>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => setPreset(7)}>7D</Button>
        <Button size="small" variant="outlined" onClick={() => setPreset(30)}>30D</Button>
        <Button size="small" variant="outlined" onClick={() => setPreset(90)}>90D</Button>
        <Button size="small" variant="outlined" onClick={() => setPreset(undefined, 12)}>12M</Button>
      </Stack>
      <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(e) => patch({ from: e.target.value })} />
      <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(e) => patch({ to: e.target.value })} />
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filters.granularity}
        onChange={(_, v) => v && patch({ granularity: v })}
      >
        {(['DAY', 'WEEK', 'MONTH', 'YEAR'] as Granularity[]).map((g) => (
          <ToggleButton key={g} value={g}>{g[0] + g.slice(1).toLowerCase()}</ToggleButton>
        ))}
      </ToggleButtonGroup>
      <TextField select size="small" label="Region" sx={{ minWidth: 140 }} value={filters.region ?? ''} onChange={(e) => patch({ region: e.target.value || undefined })}>
        <MenuItem value="">All regions</MenuItem>
        {/* Region options come from /service-areas in a fuller build; left open here. */}
      </TextField>
    </Stack>
  );
}
