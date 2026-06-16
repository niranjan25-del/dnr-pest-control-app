// src/hooks/useServerTable.ts
// Drives server-side tables: page / limit / sort / order / search / arbitrary filters, all
// synced to the URL query string so views are shareable and survive refresh. Returns the
// state, setters, and a ready-to-send `params` object for the API.

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SortOrder = 'asc' | 'desc';

export interface ServerTableState {
  page: number; // 1-based
  limit: number;
  sort?: string;
  order: SortOrder;
  search: string;
  filters: Record<string, string>;
}


export function useServerTable(options?: { defaultLimit?: number; filterKeys?: string[] }) {
  const { defaultLimit = 20, filterKeys = [] } = options ?? {};
  const [params, setParams] = useSearchParams();

  const state: ServerTableState = useMemo(() => {
    const filters: Record<string, string> = {};
    for (const key of filterKeys) {
      const v = params.get(key);
      if (v) filters[key] = v;
    }
    return {
      page: Number(params.get('page') ?? '1'),
      limit: Number(params.get('limit') ?? String(defaultLimit)),
      sort: params.get('sort') ?? undefined,
      order: (params.get('order') as SortOrder) ?? 'desc',
      search: params.get('q') ?? '',
      filters,
    };
  }, [params, filterKeys, defaultLimit]);

  const patch = useCallback(
    (next: Record<string, string | number | undefined>, resetPage = true) => {
      setParams((prev) => {
        const sp = new URLSearchParams(prev);
        if (resetPage) sp.set('page', '1');
        for (const [k, v] of Object.entries(next)) {
          if (v === undefined || v === '') sp.delete(k);
          else sp.set(k, String(v));
        }
        return sp;
      });
    },
    [setParams],
  );

  const setPage = useCallback((page: number) => patch({ page }, false), [patch]);
  const setLimit = useCallback((limit: number) => patch({ limit }), [patch]);
  const setSearch = useCallback((q: string) => patch({ q }), [patch]);
  const setFilter = useCallback((key: string, value?: string) => patch({ [key]: value }), [patch]);
  const setSort = useCallback(
    (field: string) =>
      patch(
        { sort: field, order: state.sort === field && state.order === 'asc' ? 'desc' : 'asc' },
        false,
      ),
    [patch, state.sort, state.order],
  );

  /** snake_case params for the backend. */
  const apiParams = useMemo(
    () => ({
      page: state.page,
      limit: state.limit,
      ...(state.sort ? { sort: state.sort, order: state.order } : {}),
      ...(state.search ? { search: state.search } : {}),
      ...state.filters,
    }),
    [state],
  );

  return { ...state, setPage, setLimit, setSearch, setFilter, setSort, apiParams };
}
