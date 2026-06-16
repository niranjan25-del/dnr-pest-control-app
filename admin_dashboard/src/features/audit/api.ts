// src/features/audit/api.ts
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
import type { QueryParams } from '@/services/createResourceService';

export interface AuditLogRow {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  ip_address: string | null;
  created_at: string;
}

export const auditApi = {
  async list(params: QueryParams): Promise<Paginated<AuditLogRow>> {
    const { data } = await apiClient.get<Paginated<AuditLogRow>>('/audit', { params });
    return data;
  },
};
