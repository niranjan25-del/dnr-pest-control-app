// src/features/payments/api.ts
import { apiClient } from '@/services/apiClient';
import type { Paginated } from '@/types';
import type { QueryParams } from '@/services/createResourceService';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';

export interface PaymentRow {
  id: string;
  status: PaymentStatus;
  method: string;
  amount: number;
  refunded_amount: number;
  currency: string;
  provider: string;
  provider_transaction_id: string | null;
  failure_reason: string | null;
  invoice_number: string | null;
  booking_id: string | null;
  created_at: string;
}

export const paymentsApi = {
  async list(params: QueryParams): Promise<Paginated<PaymentRow>> {
    const { data } = await apiClient.get<Paginated<PaymentRow>>('/payments/history', { params });
    return data;
  },
};
