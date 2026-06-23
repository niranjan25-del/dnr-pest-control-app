// src/features/notifications/api.ts
// Admin notification calls: targeted send, broadcast announcement, and history.
// Endpoints: POST /notifications/send (ADMIN), POST /notifications/broadcast (ADMIN),
// GET /notifications (history).

import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { BroadcastValues, NotificationRow, SendNotificationValues } from './types';

export const notificationsApi = {
  async history(params: QueryParams): Promise<Paginated<NotificationRow>> {
    const { data } = await apiClient.get<Paginated<NotificationRow>>('/notifications', { params });
    return data;
  },
  async send(body: SendNotificationValues): Promise<void> {
    await apiClient.post('/notifications/send', body);
  },
  async broadcast(body: BroadcastValues): Promise<void> {
    await apiClient.post('/notifications/broadcast', body);
  },
};
