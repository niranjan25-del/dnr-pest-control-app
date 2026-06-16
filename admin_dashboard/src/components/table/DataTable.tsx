// src/components/table/DataTable.tsx
// Generic server-driven table: typed columns, sortable headers, loading skeleton, error +
// empty states, row click, and a server pagination footer. Used by every list page so they
// behave identically. (Custom MUI Table rather than DataGrid for full control over the
// server-side sort/paginate contract.)

import {
  Box, Paper, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { ErrorState } from '@/components/feedback';
import type { SortOrder } from '@/hooks/useServerTable';

export interface Column<T> {
  field: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  total: number;
  loading?: boolean;
  error?: unknown;
  page: number; // 1-based
  limit: number;
  sort?: string;
  order: SortOrder;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onRowClick?: (row: T) => void;
  getRowId: (row: T) => string;
  onRetry?: () => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns, rows, total, loading, error, page, limit, sort, order,
  onSort, onPageChange, onLimitChange, onRowClick, getRowId, onRetry, emptyMessage = 'No results',
}: DataTableProps<T>) {
  if (error) {
    return <Paper variant="outlined" sx={{ p: 2 }}><ErrorState error={error} onRetry={onRetry} /></Paper>;
  }

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field} align={col.align} style={{ width: col.width, fontWeight: 600 }}>
                  {col.sortable ? (
                    <TableSortLabel active={sort === col.field} direction={sort === col.field ? order : 'asc'} onClick={() => onSort(col.field)}>
                      {col.header}
                    </TableSortLabel>
                  ) : (
                    col.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`s-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={col.field}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.field] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={Math.max(0, page - 1)}
        rowsPerPage={limit}
        onPageChange={(_, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 20, 50, 100]}
      />
    </Paper>
  );
}
