// src/services/createResourceService.ts
// Thin factory over the api client for the common REST shape (paginated list, get-by-id,
// create, patch, post-action). Feature services compose this and add domain-specific calls.

import { apiClient } from './apiClient';
import type { Paginated } from '@/types';

export type QueryParams = Record<string, string | number | boolean | undefined>;

function unwrap<T>(data: unknown): T {
  const m = data as { data?: T };
  return (m && typeof m === 'object' && 'data' in m ? m.data : data) as T;
}

export function createResourceService<T>(basePath: string) {
  return {
    async list(params?: QueryParams): Promise<Paginated<T>> {
      const { data } = await apiClient.get<Paginated<T>>(basePath, { params });
      return data;
    },
    async get(id: string): Promise<T> {
      const { data } = await apiClient.get(`${basePath}/${id}`);
      return unwrap<T>(data);
    },
    async create(body: unknown): Promise<T> {
      const { data } = await apiClient.post(basePath, body);
      return unwrap<T>(data);
    },
    async patch(id: string, body: unknown): Promise<T> {
      const { data } = await apiClient.patch(`${basePath}/${id}`, body);
      return unwrap<T>(data);
    },
    async action<R = unknown>(path: string, body?: unknown): Promise<R> {
      const { data } = await apiClient.post(`${basePath}${path}`, body);
      return unwrap<R>(data);
    },
  };
}
