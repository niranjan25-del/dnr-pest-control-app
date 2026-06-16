// src/modules/notifications/templates/index.ts
//
// Notification content templates → { type, title, body, data }. Pure functions, so they're
// trivial to unit-test and reuse across event triggers. Subscription/reminder content maps to
// PAYMENT/BOOKING types (no dedicated enum values).

import { NotificationType } from '@prisma/client';
import { NotificationPayload } from '../interfaces';

export const templates = {
  bookingConfirmation(p: { bookingId: string; scheduledStart: Date }): NotificationPayload {
    return {
      type: NotificationType.BOOKING,
      title: 'Booking confirmed',
      body: `Your pest control service is scheduled for ${p.scheduledStart.toISOString().slice(0, 16).replace('T', ' ')}.`,
      data: { bookingId: p.bookingId, event: 'booking.created' },
    };
  },

  technicianAssigned(p: { bookingId: string; technicianName?: string }): NotificationPayload {
    return {
      type: NotificationType.ASSIGNMENT,
      title: 'Technician assigned',
      body: p.technicianName ? `${p.technicianName} has been assigned to your service.` : 'A technician has been assigned to your service.',
      data: { bookingId: p.bookingId, event: 'booking.assigned' },
    };
  },

  newAssignment(p: { bookingId: string; scheduledStart: Date }): NotificationPayload {
    return {
      type: NotificationType.ASSIGNMENT,
      title: 'New job assigned',
      body: `You have a new service on ${p.scheduledStart.toISOString().slice(0, 16).replace('T', ' ')}.`,
      data: { bookingId: p.bookingId, event: 'assignment.new' },
    };
  },

  technicianEnRoute(p: { bookingId: string }): NotificationPayload {
    return {
      type: NotificationType.BOOKING,
      title: 'Technician en route',
      body: 'Your technician is on the way.',
      data: { bookingId: p.bookingId, event: 'booking.en_route' },
    };
  },

  bookingCompleted(p: { bookingId: string }): NotificationPayload {
    return {
      type: NotificationType.BOOKING,
      title: 'Service completed',
      body: 'Your pest control service is complete. Thank you!',
      data: { bookingId: p.bookingId, event: 'booking.completed' },
    };
  },

  paymentSuccess(p: { amount: number; currency: string; invoiceNumber?: string }): NotificationPayload {
    return {
      type: NotificationType.PAYMENT,
      title: 'Payment received',
      body: `We received your payment of ${p.currency} ${p.amount.toFixed(2)}.`,
      data: { invoiceNumber: p.invoiceNumber, event: 'payment.succeeded' },
    };
  },

  paymentFailed(p: { amount: number; currency: string }): NotificationPayload {
    return {
      type: NotificationType.PAYMENT,
      title: 'Payment failed',
      body: `Your payment of ${p.currency} ${p.amount.toFixed(2)} could not be processed. Please try again.`,
      data: { event: 'payment.failed' },
    };
  },

  subscriptionReminder(p: { planName: string; date: Date }): NotificationPayload {
    return {
      type: NotificationType.PAYMENT, // no SUBSCRIPTION enum value
      title: 'Upcoming subscription renewal',
      body: `Your ${p.planName} plan renews on ${p.date.toISOString().slice(0, 10)}.`,
      data: { event: 'subscription.renewal' },
    };
  },

  appointmentReminder(p: { bookingId: string; scheduledStart: Date }): NotificationPayload {
    return {
      type: NotificationType.BOOKING, // no REMINDER enum value
      title: 'Appointment reminder',
      body: `Reminder: your service is on ${p.scheduledStart.toISOString().slice(0, 16).replace('T', ' ')}.`,
      data: { bookingId: p.bookingId, event: 'booking.reminder' },
    };
  },

  newChatMessage(p: { conversationId: string; preview: string }): NotificationPayload {
    return {
      type: NotificationType.CHAT,
      title: 'New message',
      body: p.preview.length > 80 ? `${p.preview.slice(0, 77)}...` : p.preview,
      data: { conversationId: p.conversationId, event: 'chat.message' },
    };
  },
};
