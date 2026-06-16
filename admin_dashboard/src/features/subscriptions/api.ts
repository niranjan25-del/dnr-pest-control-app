// src/features/subscriptions/api.ts
import { createResourceService, type QueryParams } from '@/services/createResourceService';
import type { SubscriptionRow } from './types';

const subs = createResourceService<SubscriptionRow>('/subscriptions');

export const subscriptionsApi = {
  list: (params: QueryParams) => subs.list(params),
  get: (id: string) => subs.get(id),
  pause: (id: string) => subs.action(`/${id}/pause`),
  resume: (id: string) => subs.action(`/${id}/resume`),
  cancel: (id: string, reason?: string) => subs.action(`/${id}/cancel`, reason ? { reason } : undefined),
};
