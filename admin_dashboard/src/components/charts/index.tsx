// src/components/charts/index.tsx
// Reusable, responsive chart primitives over Recharts. Each chart sits in a ChartCard that
// owns the loading / empty / error states and a fixed-height ResponsiveContainer, so pages
// stay declarative. Recharts chosen for composability + responsiveness; nivo/visx are fine
// alternatives if more bespoke viz is needed later.

import { Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ErrorState } from '@/components/feedback';

export function useChartColors() {
  const theme = useTheme();
  return [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
  ];
}

// ---- KPI card ----
export function KpiCard({ label, value, helper, delta, loading }: { label: string; value: string; helper?: string; delta?: number; loading?: boolean }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {loading ? (
          <Skeleton width="60%" height={40} />
        ) : (
          <Typography variant="h2" sx={{ mt: 0.5 }}>{value}</Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          {delta != null && !loading && (
            <Typography variant="caption" color={positive ? 'success.main' : 'error.main'}>
              {positive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
            </Typography>
          )}
          {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---- Chart card wrapper (states + height) ----
interface ChartCardProps {
  title: string;
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  height?: number;
  action?: ReactNode;
  children: ReactNode;
  onRetry?: () => void;
}
export function ChartCard({ title, loading, error, isEmpty, height = 300, action, children, onRetry }: ChartCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h4">{title}</Typography>
          {action}
        </Stack>
        <Box sx={{ height }}>
          {loading ? (
            <Skeleton variant="rounded" height={height} />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : isEmpty ? (
            <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
              <Typography color="text.secondary">No data for this range</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={height}>{children as React.ReactElement}</ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ---- Line ----
export function LineSeriesChart<T extends Record<string, unknown>>({ data, xKey, series, valueFormatter }: {
  data: T[]; xKey: string; series: { key: string; name: string; color: string }[]; valueFormatter?: (v: number) => string;
}) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey={xKey} fontSize={12} tickMargin={8} />
      <YAxis fontSize={12} width={56} tickFormatter={valueFormatter} />
      <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
      {series.length > 1 && <Legend />}
      {series.map((s) => (
        <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
      ))}
    </LineChart>
  );
}

// ---- Bar ----
export function BarSeriesChart<T extends Record<string, unknown>>({ data, xKey, barKey, color, valueFormatter }: {
  data: T[]; xKey: string; barKey: string; color: string; valueFormatter?: (v: number) => string;
}) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
      <XAxis dataKey={xKey} fontSize={12} tickMargin={8} />
      <YAxis fontSize={12} width={56} tickFormatter={valueFormatter} />
      <Tooltip formatter={valueFormatter ? (v: number) => valueFormatter(v) : undefined} />
      <Bar dataKey={barKey} fill={color} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}

// ---- Pie / donut ----
export function PieBreakdownChart<T extends Record<string, unknown>>({ data, nameKey, valueKey, colors }: {
  data: T[]; nameKey: string; valueKey: string; colors: string[];
}) {
  return (
    <PieChart>
      <Pie data={data} nameKey={nameKey} dataKey={valueKey} innerRadius={60} outerRadius={100} paddingAngle={2}>
        {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
}
