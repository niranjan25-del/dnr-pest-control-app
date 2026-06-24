// src/modules/bookings/interfaces/index.ts
//
// Light shared types for the bookings module. Response shaping lives in the service
// (toResponse); these document the public booking shape for consumers/tests.

import { BookingStatus } from "@prisma/client";

export interface BookingResponse {
  id: string;
  booking_number: string;
  status: BookingStatus;
  scheduled_start: Date;
  scheduled_end: Date;
  price: number;
  discount_amount: number;
  currency: string;
  notes: string | null;
  cancellation_reason: string | null;
  cancellation_fee_applied: boolean;
  service: { id: string; name: string } | null;
  package: { id: string; name: string } | null;
  created_at: Date;
  updated_at: Date;
}
