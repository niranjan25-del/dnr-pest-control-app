// src/routes/router.tsx
// Route tree. Public: /login (AuthLayout). Protected: everything under DashboardLayout,
// gated by ProtectedRoute, with per-section PermissionRoute wrappers. Management modules
// (bookings, customers, technicians) are wired here; more attach the same way.

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute, PermissionRoute } from './guards';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHomePage } from '@/pages/DashboardHomePage';
import { ForbiddenPage, NotFoundPage } from '@/pages/StatusPages';
import { Permission } from '@/features/auth/permissions';
import { paths } from './paths';

// Management module pages
import { BookingsListPage } from '@/features/bookings/BookingsListPage';
import { BookingDetailPage } from '@/features/bookings/BookingDetailPage';
import { CustomersListPage } from '@/features/customers/CustomersListPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { TechniciansListPage } from '@/features/technicians/TechniciansListPage';
import { TechnicianDetailPage } from '@/features/technicians/TechnicianDetailPage';
import { CatalogPage } from '@/features/services/CatalogPage';
import { PricingPage } from '@/features/pricing/PricingPage';
import { SubscriptionsListPage } from '@/features/subscriptions/SubscriptionsListPage';
import { CouponsListPage } from '@/features/coupons/CouponsListPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { DispatchPage } from '@/features/dispatch/DispatchPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { ReviewsPage } from '@/features/reviews/ReviewsPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { AdminUsersPage } from '@/features/admin-users/AdminUsersPage';

// Analytics + reports
import { AnalyticsLayout } from '@/features/analytics/AnalyticsLayout';
import { ExecutiveDashboardPage } from '@/features/analytics/ExecutiveDashboardPage';
import { RevenueAnalyticsPage } from '@/features/analytics/RevenueAnalyticsPage';
import { BookingAnalyticsPage } from '@/features/analytics/BookingAnalyticsPage';
import { CustomerAnalyticsPage } from '@/features/analytics/CustomerAnalyticsPage';
import { TechnicianAnalyticsPage } from '@/features/analytics/TechnicianAnalyticsPage';
import { SubscriptionAnalyticsPage, ReviewAnalyticsPage, ServicesAnalyticsPage } from '@/features/analytics/SubscriptionReviewPages';
import { ReportsPage } from '@/features/reports/ReportsPage';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: paths.login, element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: paths.root, element: <Navigate to={paths.dashboard} replace /> },

          // Dashboard
          {
            element: <PermissionRoute permission={Permission.ViewDashboard} />,
            children: [{ path: paths.dashboard, element: <DashboardHomePage /> }],
          },

          // Bookings
          {
            element: <PermissionRoute permission={Permission.ModifyBooking} />,
            children: [
              { path: paths.bookings, element: <BookingsListPage /> },
              { path: `${paths.bookings}/:id`, element: <BookingDetailPage /> },
            ],
          },

          // Customers
          {
            element: <PermissionRoute permission={Permission.ManageCustomers} />,
            children: [
              { path: paths.customers, element: <CustomersListPage /> },
              { path: `${paths.customers}/:id`, element: <CustomerDetailPage /> },
            ],
          },

          // Technicians
          {
            element: <PermissionRoute permission={Permission.ManageTechnicians} />,
            children: [
              { path: paths.technicians, element: <TechniciansListPage /> },
              { path: `${paths.technicians}/:id`, element: <TechnicianDetailPage /> },
            ],
          },

          // Dispatch
          {
            element: <PermissionRoute permission={Permission.AssignTechnician} />,
            children: [{ path: paths.dispatch, element: <DispatchPage /> }],
          },

          // Catalog / Services / Pest Categories / Service Areas
          {
            element: <PermissionRoute permission={Permission.ManageCatalog} />,
            children: [{ path: paths.catalog, element: <CatalogPage /> }],
          },

          // Pricing
          {
            element: <PermissionRoute permission={Permission.ManagePricing} />,
            children: [{ path: paths.pricing, element: <PricingPage /> }],
          },

          // Subscriptions
          {
            element: <PermissionRoute permission={Permission.ManageCustomers} />,
            children: [{ path: paths.subscriptions, element: <SubscriptionsListPage /> }],
          },

          // Coupons
          {
            element: <PermissionRoute permission={Permission.ManageCoupons} />,
            children: [{ path: paths.coupons, element: <CouponsListPage /> }],
          },

          // Payments
          {
            element: <PermissionRoute permission={Permission.ViewPayments} />,
            children: [{ path: paths.payments, element: <PaymentsPage /> }],
          },

          // Reviews
          {
            element: <PermissionRoute permission={Permission.ModerateReviews} />,
            children: [{ path: paths.reviews, element: <ReviewsPage /> }],
          },

          // Audit Log
          {
            element: <PermissionRoute permission={Permission.ViewAuditLogs} />,
            children: [{ path: paths.audit, element: <AuditLogPage /> }],
          },

          // Notifications / broadcasts
          {
            element: <PermissionRoute permission={Permission.SendBroadcasts} />,
            children: [{ path: paths.broadcasts, element: <NotificationsPage /> }],
          },

          // Analytics (tabbed section, shared filters)
          {
            element: <PermissionRoute permission={Permission.ViewDashboard} />,
            children: [
              {
                path: paths.analytics,
                element: <AnalyticsLayout />,
                children: [
                  { index: true, element: <ExecutiveDashboardPage /> },
                  { path: 'revenue', element: <RevenueAnalyticsPage /> },
                  { path: 'bookings', element: <BookingAnalyticsPage /> },
                  { path: 'customers', element: <CustomerAnalyticsPage /> },
                  { path: 'technicians', element: <TechnicianAnalyticsPage /> },
                  { path: 'subscriptions', element: <SubscriptionAnalyticsPage /> },
                  { path: 'reviews', element: <ReviewAnalyticsPage /> },
                  { path: 'services', element: <ServicesAnalyticsPage /> },
                ],
              },
            ],
          },

          // Reports + exports
          {
            element: <PermissionRoute permission={Permission.ComplianceExport} />,
            children: [{ path: paths.reports, element: <ReportsPage /> }],
          },

          // Admin user management (SUPER_ADMIN only)
          {
            element: <PermissionRoute permission={Permission.ManageRoles} />,
            children: [{ path: paths.adminUsers, element: <AdminUsersPage /> }],
          },

          { path: paths.forbidden, element: <ForbiddenPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
