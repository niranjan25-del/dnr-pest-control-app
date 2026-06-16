// src/features/technicians/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { techniciansApi } from './api';
import type { QueryParams } from '@/services/createResourceService';
import type { UserStatus } from '@/features/customers/types';

const keys = {
  all: ['technicians'] as const,
  list: (p: QueryParams) => ['technicians', 'list', p] as const,
  profile: (id: string) => ['technicians', 'profile', id] as const,
  serviceAreas: ['technicians', 'service-areas'] as const,
};

export function useTechnicians(params: QueryParams) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => techniciansApi.list(params), placeholderData: (p) => p });
}
export function useTechnicianProfile(id: string) {
  return useQuery({ queryKey: keys.profile(id), queryFn: () => techniciansApi.profile(id), enabled: Boolean(id) });
}
export function useServiceAreas() {
  return useQuery({ queryKey: keys.serviceAreas, queryFn: () => techniciansApi.serviceAreas() });
}

export function useUpdateTechnician(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { skills?: string[]; service_area_ids?: string[] }) => techniciansApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profile(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useSetTechnicianStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; status: UserStatus; reason?: string }) => techniciansApi.setStatus(vars.userId, vars.status, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
