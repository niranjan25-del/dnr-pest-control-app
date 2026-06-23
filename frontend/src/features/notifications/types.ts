// src/features/notifications/types.ts
export interface NotificationRow {
  id: string;
  type?: string;
  title: string;
  body?: string | null;
  status?: string;
  created_at?: string;
}

export interface SendNotificationValues {
  user_id?: string;       // targeted send (optional)
  title: string;
  body: string;
  type?: string;
}

export interface BroadcastValues {
  title: string;
  body: string;
  audience: 'ALL' | 'CUSTOMERS' | 'TECHNICIANS';
}

// src/features/notifications/api.ts logic colocated below for brevity.
