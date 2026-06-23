// src/features/subscriptions/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from './api';
import type { QueryParams } from '@/services/createResourceService';

const keys = { all: ['subscriptions'] as const, list: (p: QueryParams) => ['subscriptions', 'list', p] as const };

export function useSubscriptions(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => subscriptionsApi.list(params), placeholderData: (p) => p });
}

type Action = 'pause' | 'resume' | 'cancel';

export function useSubscriptionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; action: Action; reason?: string }) => {
      if (vars.action === 'pause') return subscriptionsApi.pause(vars.id);
      if (vars.action === 'resume') return subscriptionsApi.resume(vars.id);
      return subscriptionsApi.cancel(vars.id, vars.reason);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
