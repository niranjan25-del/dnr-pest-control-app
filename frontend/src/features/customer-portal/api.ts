import { apiClient } from '@/services/apiClient';
import type { QueryParams } from '@/services/createResourceService';
import type { Paginated } from '@/types';
import type {
  CouponPreview,
  CustomerAddress, CustomerBooking, CashfreeOrderResult, CustomerInvoice, CustomerReview,
  CustomerSelfProfile, CustomerServiceReport, CustomerSubscription, CustomerWarranty,
  PackageOption, ServiceOption,
} from './types';

export const customerPortalApi = {
  // ── Profile ─────────────────────────────────────────────────────────────
  async getProfile(): Promise<CustomerSelfProfile> {
    const { data } = await apiClient.get<CustomerSelfProfile>('/customers/me');
    return data;
  },

  async updateProfile(body: { full_name?: string; phone?: string; company_name?: string }): Promise<CustomerSelfProfile> {
    const { data } = await apiClient.patch<CustomerSelfProfile>('/customers/me', body);
    return data;
  },

  // ── Addresses ────────────────────────────────────────────────────────────
  async listAddresses(): Promise<CustomerAddress[]> {
    const { data } = await apiClient.get<CustomerAddress[]>('/customers/me/addresses');
    return data;
  },

  async createAddress(body: {
    label?: string; line1: string; line2?: string; city: string; state: string;
    postal_code: string; country?: string; is_default?: boolean;
  }): Promise<CustomerAddress> {
    const { data } = await apiClient.post<CustomerAddress>('/customers/me/addresses', body);
    return data;
  },

  async updateAddress(id: string, body: Partial<{
    label: string; line1: string; line2: string; city: string; state: string;
    postal_code: string; country: string; is_default: boolean;
  }>): Promise<CustomerAddress> {
    const { data } = await apiClient.patch<CustomerAddress>(`/customers/me/addresses/${id}`, body);
    return data;
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete(`/customers/me/addresses/${id}`);
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  async listBookings(params: QueryParams): Promise<Paginated<CustomerBooking>> {
    const { data } = await apiClient.get<Paginated<CustomerBooking>>('/bookings/customer/history', { params });
    return data;
  },

  async getBooking(id: string): Promise<CustomerBooking> {
    const { data } = await apiClient.get<CustomerBooking>(`/bookings/${id}`);
    return data;
  },

  async cancelBooking(id: string, reason?: string): Promise<CustomerBooking> {
    const { data } = await apiClient.patch<CustomerBooking>(`/bookings/${id}/cancel`, { reason });
    return data;
  },

  async rescheduleBooking(id: string, scheduledStart: string, reason?: string): Promise<CustomerBooking> {
    const { data } = await apiClient.patch<CustomerBooking>(`/bookings/${id}/reschedule`, { scheduledStart, reason });
    return data;
  },

  async createBooking(body: {
    serviceId?: string;
    packageId?: string;
    addressId: string;
    scheduledStart: string;
    notes?: string;
    priority?: string;
  }): Promise<CustomerBooking> {
    const { data } = await apiClient.post<CustomerBooking>('/bookings', body);
    return data;
  },

  // ── Service Areas ──────────────────────────────────────────────────────────
  async checkCoverage(postalCode: string): Promise<{ postal_code: string; covered: boolean; areas: { id: string; name: string }[] }> {
    const { data } = await apiClient.get('/service-areas/coverage', { params: { postalCode } });
    return data;
  },

  // ── Invoices ──────────────────────────────────────────────────────────────
  async listInvoices(params: QueryParams): Promise<Paginated<CustomerInvoice>> {
    const { data } = await apiClient.get<Paginated<CustomerInvoice>>('/invoices/customer/history', { params });
    return data;
  },

  async getInvoice(id: string): Promise<CustomerInvoice> {
    const { data } = await apiClient.get<CustomerInvoice>(`/invoices/${id}`);
    return data;
  },

  // ── Payments (Cashfree) ───────────────────────────────────────────────────
  async createCashfreeOrder(bookingId: string): Promise<CashfreeOrderResult> {
    const { data } = await apiClient.post<CashfreeOrderResult>('/payments/create-intent', { bookingId });
    return data;
  },

  async confirmCashfreePayment(orderId: string): Promise<{ status: string; payment_id: string }> {
    const { data } = await apiClient.post('/payments/confirm', { orderId });
    return data;
  },

  // ── Service Reports ────────────────────────────────────────────────────────
  async listServiceReports(): Promise<CustomerServiceReport[]> {
    const { data } = await apiClient.get<CustomerServiceReport[] | { data?: CustomerServiceReport[] }>('/service-reports/customer/history');
    return (data as { data?: CustomerServiceReport[] }).data ?? (data as CustomerServiceReport[]);
  },

  async getServiceReport(id: string): Promise<CustomerServiceReport> {
    const { data } = await apiClient.get<CustomerServiceReport>(`/service-reports/${id}`);
    return data;
  },

  // ── Coupons ───────────────────────────────────────────────────────────────
  async validateCoupon(code: string, opts?: { bookingId?: string; amount?: number }): Promise<CouponPreview> {
    const { data } = await apiClient.post<CouponPreview>('/coupons/validate', { code, ...opts });
    return data;
  },

  async redeemCoupon(code: string, bookingId: string): Promise<{ code: string; discount_amount: number; final_amount: number }> {
    const { data } = await apiClient.post<{ code: string; discount_amount: number; final_amount: number }>('/coupons/redeem', { code, bookingId });
    return data;
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  async submitReview(body: { bookingId: string; rating: number; comment?: string }): Promise<CustomerReview> {
    const { data } = await apiClient.post<CustomerReview>('/reviews', {
      booking_id: body.bookingId,
      rating: body.rating,
      comment: body.comment,
    });
    return data;
  },

  // ── Subscriptions ──────────────────────────────────────────────────────────
  async listSubscriptions(): Promise<CustomerSubscription[]> {
    const { data } = await apiClient.get<CustomerSubscription[] | { data?: CustomerSubscription[] }>('/subscriptions');
    return (data as { data?: CustomerSubscription[] }).data ?? (data as CustomerSubscription[]);
  },

  async pauseSubscription(id: string): Promise<CustomerSubscription> {
    const { data } = await apiClient.post<CustomerSubscription>(`/subscriptions/${id}/pause`, {});
    return data;
  },

  async resumeSubscription(id: string): Promise<CustomerSubscription> {
    const { data } = await apiClient.post<CustomerSubscription>(`/subscriptions/${id}/resume`, {});
    return data;
  },

  async cancelSubscription(id: string, reason?: string): Promise<CustomerSubscription> {
    const { data } = await apiClient.post<CustomerSubscription>(`/subscriptions/${id}/cancel`, { reason });
    return data;
  },

  // ── Invoice PDF ───────────────────────────────────────────────────────────
  async downloadInvoicePdf(id: string): Promise<void> {
    const response = await apiClient.get(`/invoices/${id}/download`, { responseType: 'blob' });
    const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `invoice-${id}.pdf`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ── Warranties ────────────────────────────────────────────────────────────
  async listWarranties(): Promise<CustomerWarranty[]> {
    const { data } = await apiClient.get<CustomerWarranty[]>('/warranties/customer');
    return data;
  },

  async getWarrantyForBooking(bookingId: string): Promise<CustomerWarranty> {
    const { data } = await apiClient.get<CustomerWarranty>(`/warranties/booking/${bookingId}`);
    return data;
  },

  // ── Catalog ───────────────────────────────────────────────────────────────
  async listServices(): Promise<ServiceOption[]> {
    const { data } = await apiClient.get<{ data?: ServiceOption[] } | ServiceOption[]>('/services', {
      params: { isActive: true, limit: 100 },
    });
    return (data as { data?: ServiceOption[] }).data ?? (data as ServiceOption[]);
  },

  async listPackages(): Promise<PackageOption[]> {
    const { data } = await apiClient.get<{ data?: PackageOption[] } | PackageOption[]>('/packages', {
      params: { isActive: true, limit: 100 },
    });
    return (data as { data?: PackageOption[] }).data ?? (data as PackageOption[]);
  },
};
