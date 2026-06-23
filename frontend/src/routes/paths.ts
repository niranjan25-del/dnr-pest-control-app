// src/routes/paths.ts
// Central route path constants.

export const paths = {
  login: '/login',
  register: '/register',
  root: '/',
  dashboard: '/dashboard',
  analytics: '/analytics',
  // Management sections:
  bookings: '/bookings',
  customers: '/customers',
  technicians: '/technicians',
  dispatch: '/dispatch',
  catalog: '/catalog',
  pricing: '/pricing',
  subscriptions: '/subscriptions',
  payments: '/payments',
  coupons: '/coupons',
  reviews: '/reviews',
  broadcasts: '/broadcasts',
  reports: '/reports',
  attendance: '/attendance',
  audit: '/audit',
  adminUsers: '/admin-users',
  settings: '/settings',
  // Technician portal
  technicianRoot: '/technician',
  technicianDashboard: '/technician/dashboard',
  technicianJobs: '/technician/jobs',
  technicianSchedule: '/technician/schedule',
  technicianProfile: '/technician/profile',
  // Customer portal
  customerRoot: '/customer',
  customerDashboard: '/customer/dashboard',
  customerBookings: '/customer/bookings',
  customerBookingDetail: '/customer/bookings/:id',
  customerProfile: '/customer/profile',
  customerBook: '/customer/book',
  customerInvoices: '/customer/invoices',
  customerServiceReports: '/customer/service-reports',
  customerSubscriptions: '/customer/subscriptions',
  customerWarranties: '/customer/warranties',
  // Status
  forbidden: '/403',
  notFound: '/404',
} as const;
