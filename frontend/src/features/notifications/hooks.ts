// src/features/notifications/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './api';
import type { QueryParams } from '@/services/createResourceService';
import type { BroadcastValues, SendNotificationValues } from './types';

const keys = { all: ['notifications'] as const, history: (p: QueryParams) => ['notifications', 'history', p] as const };

export function useNotificationHistory(params: QueryParams) {
  return useQuery({ queryKey: keys.history(params), queryFn: () => notificationsApi.history(params), placeholderData: (p) => p });
}

export function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendNotificationValues) => notificationsApi.send(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BroadcastValues) => notificationsApi.broadcast(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
