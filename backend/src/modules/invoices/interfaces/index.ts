// src/modules/invoices/interfaces/index.ts

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  issuedDate: Date;
  dueDate: Date | null;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    address?: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  tax: { label: string; rate: number; amount: number };
  total: number;
  payment?: {
    method: string;
    status: string;
    amount: number;
    transactionId: string | null;
  } | null;
}

export interface DownloadLink {
  url: string;
  expires_in: number;
}
