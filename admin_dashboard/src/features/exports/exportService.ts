// src/features/exports/exportService.ts
// Two export paths:
//   • downloadCsv — build a CSV client-side from already-fetched rows (no extra deps).
//   • downloadServerExport — hit GET /analytics/export?reportType=&format=&from=&to=&
//     granularity= and save the returned blob (CSV or PDF rendered by the backend). Server
//     export is preferred for large datasets and audited PDFs.

import { apiClient } from '@/services/apiClient';
import type { AnalyticsFilters, ExportFormat, ReportType } from '@/features/analytics/types';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Client-side CSV from an array of records + ordered headers. */
export function downloadCsv(filename: string, headers: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map((h) => escape(h.label)).join(',');
  const body = rows.map((r) => headers.map((h) => escape(r[h.key])).join(',')).join('\n');
  triggerDownload(new Blob([`${head}\n${body}`], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Server-rendered export (CSV, Excel, or PDF) via the analytics export endpoint. */
export async function downloadServerExport(reportType: ReportType, format: ExportFormat, filters: AnalyticsFilters) {
  const res = await apiClient.get('/analytics/export', {
    params: {
      reportType,
      format,
      from: filters.from,
      to: filters.to,
      granularity: filters.granularity,
    },
    responseType: 'blob',
  });
  const ext = format === 'EXCEL' ? 'xlsx' : format.toLowerCase();
  triggerDownload(res.data as Blob, `dnr-${reportType.toLowerCase()}-${filters.from}_${filters.to}.${ext}`);
}
