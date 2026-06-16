// src/features/customers/types.ts
// Customer DTOs. The admin list comes from /users?role=CUSTOMER (UserRow); the detail comes
// from /customers/:id (CustomerProfile). Account status is the shared UserStatus enum.

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserRow {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role: string;
  status: UserStatus;
  created_at?: string;
}

export interface CustomerProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  customer_type?: string;
  status?: UserStatus;
  created_at?: string;
}

export interface InvoiceRow {
  id: string;
  invoice_number?: string;
  total_amount: string;
  currency: string;
  status: string;
  created_at?: string;
}
