// src/modules/payments/interfaces/index.ts

export interface PaymentOrderResult {
  payment_id: string; // our internal Payment record id
  order_id: string; // Cashfree order_id (stored as providerTransactionId)
  payment_session_id: string; // Flutter/web SDK uses this to launch Cashfree checkout
  amount: number; // major units (INR)
  currency: string;
  status: string; // Cashfree order status: ACTIVE | PAID | EXPIRED
}

export interface SavedInstrument {
  id: string; // Cashfree instrument_id
  type: string; // "card"
  brand: string; // card network, e.g. "visa", "mastercard"
  card_display: string; // last-4 display string from Cashfree
}
