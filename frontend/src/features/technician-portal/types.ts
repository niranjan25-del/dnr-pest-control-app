export type JobStatus =
  | 'PENDING' | 'CONFIRMED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED'
  | 'CANCELLED' | 'NO_SHOW';

export interface TechJob {
  id: string;
  status: JobStatus;
  service_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address_line?: string | null;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  notes?: string | null;
  access_notes?: string | null;
  latitude?: number;
  longitude?: number;
  price?: number;
  needs_acceptance?: boolean;
}

export interface TechProfile {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  license_number?: string;
  license_expiry?: string;
  skills: string[];
  is_available: boolean;
  rating_average: number;
  jobs_completed: number;
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING:     'Pending',
  CONFIRMED:   'Confirmed',
  EN_ROUTE:    'En Route',
  ARRIVED:     'Arrived',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
  NO_SHOW:     'No Show',
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  PENDING:     '#9E9E9E',
  CONFIRMED:   '#1E8E5A',
  EN_ROUTE:    '#2196F3',
  ARRIVED:     '#FF9800',
  IN_PROGRESS: '#9C27B0',
  COMPLETED:   '#4CAF50',
  CANCELLED:   '#F44336',
  NO_SHOW:     '#F44336',
};

export const ACTIVE_STATUSES: JobStatus[] = ['CONFIRMED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];

export const WORKFLOW_NEXT: Partial<Record<JobStatus, JobStatus>> = {
  CONFIRMED:   'EN_ROUTE',
  EN_ROUTE:    'ARRIVED',
  ARRIVED:     'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

export const WORKFLOW_NEXT_LABEL: Partial<Record<JobStatus, string>> = {
  CONFIRMED:   'Start driving',
  EN_ROUTE:    'Mark arrived',
  ARRIVED:     'Start work',
  IN_PROGRESS: 'Complete job',
};
