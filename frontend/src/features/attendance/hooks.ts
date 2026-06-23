import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, techAttendanceApi } from './api';

export const attendanceKeys = {
  list: (params: object) => ['attendance', 'list', params] as const,
  dutyStatus: () => ['attendance', 'duty-status'] as const,
};

// Admin — general list (used on the standalone page if ever needed)
export function useAttendanceList(params: Parameters<typeof attendanceApi.list>[0]) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: () => attendanceApi.list(params),
  });
}

// Admin — single technician history (used in TechnicianDetailPage)
export function useTechnicianAttendance(userId: string, params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: attendanceKeys.list({ user_id: userId, ...params }),
    queryFn: () => attendanceApi.list({ user_id: userId, limit: 200, ...params }),
    enabled: !!userId,
  });
}

// Technician portal
export function useDutyStatus() {
  return useQuery({
    queryKey: attendanceKeys.dutyStatus(),
    queryFn: techAttendanceApi.status,
    refetchInterval: 60_000,
  });
}

export function usePunchIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => techAttendanceApi.punchIn(note),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.dutyStatus() }),
  });
}

export function usePunchOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => techAttendanceApi.punchOut(note),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.dutyStatus() }),
  });
}
