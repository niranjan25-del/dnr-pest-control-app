export interface DutyLog {
  id: string;
  technician_id: string;
  full_name: string;
  date: string;
  punched_in_at: string;
  punched_out_at: string | null;
  duration_minutes: number | null;
  note: string | null;
}

export interface AttendanceListResponse {
  data: DutyLog[];
  total: number;
  page: number;
  limit: number;
}

export type DutyStatus = 'NOT_PUNCHED_IN' | 'ON_DUTY' | 'PUNCHED_OUT';

export interface DutyStatusResponse {
  status: DutyStatus;
  log: DutyLog | null;
  sessions: DutyLog[];
}
