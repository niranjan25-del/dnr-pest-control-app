// src/routes/paths.ts
// Central route path constants. Management module paths are declared now (so the sidebar +
// permission map can reference them) but their pages are added in later modules.

export const paths = {
  login: '/login',
  root: '/',
  dashboard: '/dashboard',
  analytics: '/analytics',
  // Management sections (pages added in later modules):
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
  audit: '/audit',
  adminUsers: '/admin-users',
  settings: '/settings',
  // Status
  forbidden: '/403',
  notFound: '/404',
} as const;
