import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type { AddressRow, CustomerProfile, CustomerReviewRow, CustomerStats, InvoiceRow, UserRow, UserStatus } from './types';
import type { BookingListItem } from '@/features/bookings/types';

export const customersApi = {
  async create(body: { fullName: string; email: string; password: string; phone?: string }): Promise<UserRow> {
    const { data } = await apiClient.post<UserRow>('/admin/customers', body);
    return data;
  },

  async list(params: QueryParams): Promise<Paginated<UserRow>> {
    const { data } = await apiClient.get<Paginated<UserRow>>('/admin/customers', { params });
    return data;
  },

  async profile(userId: string): Promise<CustomerProfile> {
    const { data } = await apiClient.get<CustomerProfile>(`/admin/customers/${userId}`);
    return data;
  },

  async updateProfile(
    userId: string,
    body: { fullName?: string; phone?: string; companyName?: string; customerType?: string },
  ): Promise<CustomerProfile> {
    const { data } = await apiClient.patch<CustomerProfile>(`/admin/customers/${userId}`, body);
    return data;
  },

  async addresses(userId: string): Promise<AddressRow[]> {
    const { data } = await apiClient.get<AddressRow[]>(`/admin/customers/${userId}/addresses`);
    return data;
  },

  async createAddress(
    userId: string,
    body: { label?: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country?: string; isDefault?: boolean },
  ): Promise<AddressRow> {
    const { data } = await apiClient.post<AddressRow>(`/admin/customers/${userId}/addresses`, body);
    return data;
  },

  async updateAddress(
    userId: string,
    addressId: string,
    body: Partial<{ label: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean }>,
  ): Promise<AddressRow> {
    const { data } = await apiClient.patch<AddressRow>(`/admin/customers/${userId}/addresses/${addressId}`, body);
    return data;
  },

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await apiClient.delete(`/admin/customers/${userId}/addresses/${addressId}`);
  },

  async bookings(customerId: string, params: QueryParams): Promise<Paginated<BookingListItem>> {
    const { data } = await apiClient.get<Paginated<BookingListItem>>('/bookings', { params: { ...params, customer_id: customerId } });
    return data;
  },

  async invoices(customerId: string, params: QueryParams): Promise<Paginated<InvoiceRow>> {
    const { data } = await apiClient.get<Paginated<InvoiceRow>>('/invoices', { params: { ...params, customer_id: customerId } });
    return data;
  },

  async stats(userId: string): Promise<CustomerStats> {
    const { data } = await apiClient.get<CustomerStats>(`/admin/customers/${userId}/stats`);
    return data;
  },

  async reviews(userId: string, params: QueryParams): Promise<Paginated<CustomerReviewRow>> {
    const { data } = await apiClient.get<Paginated<CustomerReviewRow>>('/reviews', {
      params: { ...params, customer_id: userId },
    });
    return data;
  },

  async setStatus(userId: string, status: UserStatus, reason?: string): Promise<void> {
    await apiClient.patch(`/users/${userId}/status`, { status, ...(reason ? { reason } : {}) });
  },
};
