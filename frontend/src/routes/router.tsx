// src/routes/router.tsx
// Route tree. Public: /login (AuthLayout). Protected: everything under DashboardLayout,
// gated by ProtectedRoute, with per-section PermissionRoute wrappers. Management modules
// (bookings, customers, technicians) are wired here; more attach the same way.
// Technicians log in via TechnicianRoute -> TechnicianLayout (their own portal).

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute, PermissionRoute, TechnicianRoute, CustomerRoute, AdminOnlyRoute } from './guards';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
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

// Technician portal
import { TechnicianLayout } from '@/features/technician-portal/TechnicianLayout';
import { TechnicianDashboardPage } from '@/features/technician-portal/TechnicianDashboardPage';
import { TechnicianJobsPage, TechnicianJobDetailPage } from '@/features/technician-portal/TechnicianJobsPage';
import { TechnicianSchedulePage } from '@/features/technician-portal/TechnicianSchedulePage';
import { TechnicianProfilePage } from '@/features/technician-portal/TechnicianProfilePage';

// Customer portal
import { CustomerLayout } from '@/features/customer-portal/CustomerLayout';
import { CustomerDashboardPage } from '@/features/customer-portal/CustomerDashboardPage';
import { CustomerBookingsPage } from '@/features/customer-portal/CustomerBookingsPage';
import { CustomerBookingDetailPage } from '@/features/customer-portal/CustomerBookingDetailPage';
import { CustomerProfilePage } from '@/features/customer-portal/CustomerProfilePage';
import { BookServicePage } from '@/features/customer-portal/BookServicePage';
import { CustomerInvoicesPage } from '@/features/customer-portal/CustomerInvoicesPage';
import { CustomerServiceReportsPage } from '@/features/customer-portal/CustomerServiceReportsPage';
import { CustomerSubscriptionsPage } from '@/features/customer-portal/CustomerSubscriptionsPage';
import { CustomerWarrantiesPage } from '@/features/customer-portal/CustomerWarrantiesPage';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: paths.login,    element: <LoginPage /> },
      { path: paths.register, element: <RegisterPage /> },
    ],
  },

  // ── Technician portal ────────────────────────────────────────────────────────
  {
    element: <TechnicianRoute />,
    children: [
      {
        element: <TechnicianLayout />,
        children: [
          { path: paths.technicianRoot,      element: <Navigate to={paths.technicianDashboard} replace /> },
          { path: paths.technicianDashboard, element: <TechnicianDashboardPage /> },
          { path: paths.technicianJobs,      element: <TechnicianJobsPage /> },
          { path: `${paths.technicianJobs}/:id`, element: <TechnicianJobDetailPage /> },
          { path: paths.technicianSchedule,  element: <TechnicianSchedulePage /> },
          { path: paths.technicianProfile,   element: <TechnicianProfilePage /> },
        ],
      },
    ],
  },

  // ── Customer portal ──────────────────────────────────────────────────────────
  {
    element: <CustomerRoute />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          { path: paths.customerRoot,           element: <Navigate to={paths.customerDashboard} replace /> },
          { path: paths.customerDashboard,      element: <CustomerDashboardPage /> },
          { path: paths.customerBookings,       element: <CustomerBookingsPage /> },
          { path: paths.customerBookingDetail,  element: <CustomerBookingDetailPage /> },
          { path: paths.customerProfile,        element: <CustomerProfilePage /> },
          { path: paths.customerBook,           element: <BookServicePage /> },
          { path: paths.customerInvoices,       element: <CustomerInvoicesPage /> },
          { path: paths.customerServiceReports, element: <CustomerServiceReportsPage /> },
          { path: paths.customerSubscriptions,  element: <CustomerSubscriptionsPage /> },
          { path: paths.customerWarranties,     element: <CustomerWarrantiesPage /> },
        ],
      },
    ],
  },

  // ── Admin / staff portal ─────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminOnlyRoute />,
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
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);