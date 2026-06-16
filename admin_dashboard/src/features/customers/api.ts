// src/features/customers/api.ts
// Customer admin calls: list via /users (role=CUSTOMER), profile via /customers/:id, their
// bookings via /bookings?customer_id=, invoices via /invoices?customer_id=, and status
// change via /users/:id/status.
//
// FLAG: confirm the list/filter params — bookings/invoices customer filter key
// (`customer_id`) and whether the customer list should use /users vs a dedicated
// /customers index. Adjust here if the backend differs.

import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { CustomerProfile, InvoiceRow, UserRow, UserStatus } from './types';
import type { BookingListItem } from '@/features/bookings/types';

export const customersApi = {
  async list(params: QueryParams): Promise<Paginated<UserRow>> {
    const { data } = await apiClient.get<Paginated<UserRow>>('/users', { params: { ...params, role: 'CUSTOMER' } });
    return data;
  },
  async profile(id: string): Promise<CustomerProfile> {
    const { data } = await apiClient.get<{ data?: CustomerProfile } | CustomerProfile>(`/customers/${id}`);
    return (data as { data?: CustomerProfile }).data ?? (data as CustomerProfile);
  },
  async bookings(customerId: string, params: QueryParams): Promise<Paginated<BookingListItem>> {
    const { data } = await apiClient.get<Paginated<BookingListItem>>('/bookings', { params: { ...params, customer_id: customerId } });
    return data;
  },
  async invoices(customerId: string, params: QueryParams): Promise<Paginated<InvoiceRow>> {
    const { data } = await apiClient.get<Paginated<InvoiceRow>>('/invoices', { params: { ...params, customer_id: customerId } });
    return data;
  },
  async setStatus(userId: string, status: UserStatus, reason?: string): Promise<void> {
    await apiClient.patch(`/users/${userId}/status`, { status, ...(reason ? { reason } : {}) });
  },
};
