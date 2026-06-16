// test/unit/booking-state-machine.spec.ts
//
// The booking state machine is the platform's most safety-critical pure logic: it gates every
// status change. These tests pin the allowed/forbidden transitions exactly as defined in
// src/modules/bookings/enums.

import { BookingStatus } from '@prisma/client';
import { isTransitionAllowed, BOOKING_TRANSITIONS } from 'src/modules/bookings/enums';

describe('Booking state machine — isTransitionAllowed', () => {
  it('allows the happy-path progression PENDING → CONFIRMED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED', () => {
    const path = [
      BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE,
      BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isTransitionAllowed(path[i], path[i + 1])).toBe(true);
    }
  });

  it('forbids skipping states (PENDING → COMPLETED)', () => {
    expect(isTransitionAllowed(BookingStatus.PENDING, BookingStatus.COMPLETED)).toBe(false);
  });

  it('forbids moving backwards (IN_PROGRESS → PENDING)', () => {
    expect(isTransitionAllowed(BookingStatus.IN_PROGRESS, BookingStatus.PENDING)).toBe(false);
  });

  it('treats COMPLETED, CANCELLED, NO_SHOW as terminal (no outgoing transitions)', () => {
    for (const terminal of [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW]) {
      expect(BOOKING_TRANSITIONS[terminal]).toEqual([]);
      expect(isTransitionAllowed(terminal, BookingStatus.PENDING)).toBe(false);
    }
  });

  it('allows cancellation from every pre-terminal active state', () => {
    for (const from of [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS]) {
      expect(isTransitionAllowed(from, BookingStatus.CANCELLED)).toBe(true);
    }
  });

  it('allows NO_SHOW only from CONFIRMED and ARRIVED', () => {
    expect(isTransitionAllowed(BookingStatus.CONFIRMED, BookingStatus.NO_SHOW)).toBe(true);
    expect(isTransitionAllowed(BookingStatus.ARRIVED, BookingStatus.NO_SHOW)).toBe(true);
    expect(isTransitionAllowed(BookingStatus.EN_ROUTE, BookingStatus.NO_SHOW)).toBe(false);
  });
});
