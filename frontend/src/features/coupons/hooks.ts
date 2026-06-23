// src/features/coupons/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { couponsApi } from './api';
import type { QueryParams } from '@/services/createResourceService';

const keys = {
  all: ['coupons'] as const,
  list: (p: QueryParams) => ['coupons', 'list', p] as const,
};

export function useCoupons(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => couponsApi.list(params), placeholderData: (p) => p });
}

export function useSaveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; body: unknown }) =>
      vars.id ? couponsApi.update(vars.id, vars.body) : couponsApi.create(vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useToggleCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      vars.active ? couponsApi.activate(vars.id) : couponsApi.deactivate(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
