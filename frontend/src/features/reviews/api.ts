// src/features/reviews/api.ts
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
import type { QueryParams } from '@/services/createResourceService';

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'FLAGGED';

export interface ReviewRow {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  customer_name: string | null;
  technician_name: string | null;
  created_at: string;
}

export const reviewsApi = {
  async list(params: QueryParams): Promise<Paginated<ReviewRow>> {
    const { data } = await apiClient.get<Paginated<ReviewRow>>('/reviews', { params });
    return data;
  },
  async moderate(id: string, status: ReviewStatus): Promise<{ id: string; status: ReviewStatus }> {
    const { data } = await apiClient.patch(`/reviews/${id}/moderate`, { status });
    return data as { id: string; status: ReviewStatus };
  },
};
