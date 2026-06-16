// src/features/services/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from './api';
import type { QueryParams } from '@/services/createResourceService';

const keys = {
  all: ['services'] as const,
  list: (p: QueryParams) => ['services', 'list', p] as const,
  packages: (p: QueryParams) => ['services', 'packages', p] as const,
  pestCategories: ['services', 'pest-categories'] as const,
};

export function useServices(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => servicesApi.list(params), placeholderData: (p) => p });
}
export function useServicePackages(params: QueryParams) {
  return useQuery({ queryKey: keys.packages(params), queryFn: () => servicesApi.listPackages(params), placeholderData: (p) => p });
}
export function usePestCategories() {
  return useQuery({ queryKey: keys.pestCategories, queryFn: () => servicesApi.pestCategories(), staleTime: 5 * 60_000 });
}

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; body: unknown }) =>
      vars.id ? servicesApi.update(vars.id, vars.body) : servicesApi.create(vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useSavePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; body: unknown }) =>
      vars.id ? servicesApi.updatePackage(vars.id, vars.body) : servicesApi.createPackage(vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
