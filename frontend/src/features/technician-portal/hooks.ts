import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { techPortalApi } from './api';

const KEYS = {
  profile: ['tech-portal', 'profile'] as const,
  jobs:    ['tech-portal', 'jobs']    as const,
};

export function useTechProfile() {
  return useQuery({ queryKey: KEYS.profile, queryFn: techPortalApi.profile });
}

export function useTechJobs() {
  return useQuery({ queryKey: KEYS.jobs, queryFn: techPortalApi.jobs });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: boolean) => techPortalApi.setAvailability(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.profile }),
  });
}

export function useAcceptJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => techPortalApi.acceptJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

export function useDeclineJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => techPortalApi.declineJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

export function useAdvanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      techPortalApi.advanceStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

export function useCompleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, photo, notes }: { id: string; photo: File; notes?: string }) =>
      techPortalApi.completeJob(id, photo, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}
