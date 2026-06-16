// lib/features/customer/customer_routes.dart
//
// Customer route tree to plug into the foundation GoRouter. A StatefulShellRoute provides
// the 4-tab bottom nav; the booking wizard, address forms, reschedule, and review are
// pushed on top (full-screen, outside the shell) so they cover the nav bar.
//
// INTEGRATION (lib/routes/app_router.dart): replace the placeholder customerHome route
// with `...customerRoutes`. The redirect already gates these to authenticated CUSTOMERs.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'addresses/address_screens.dart';
import 'bookings/booking_flow/booking_flow_screen.dart';
import 'bookings/booking_screens.dart';
import 'customer_shell.dart';
import 'dashboard/dashboard_screen.dart';
import 'notifications/notification_center_screen.dart';
import 'profile/profile_screen.dart';
import 'reviews/review_screen.dart';
import 'subscriptions/subscription_screens.dart';
import 'shared/models/customer_models.dart';

final _homeKey = GlobalKey<NavigatorState>(debugLabel: 'home');
final _bookingsKey = GlobalKey<NavigatorState>(debugLabel: 'bookings');
final _alertsKey = GlobalKey<NavigatorState>(debugLabel: 'alerts');
final _profileKey = GlobalKey<NavigatorState>(debugLabel: 'profile');

final List<RouteBase> customerRoutes = [
  StatefulShellRoute.indexedStack(
    builder: (_, __, shell) => CustomerShell(shell: shell),
    branches: [
      StatefulShellBranch(navigatorKey: _homeKey, routes: [
        GoRoute(path: '/customer', builder: (_, __) => const DashboardScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _bookingsKey, routes: [
        GoRoute(path: '/customer/bookings', builder: (_, __) => const BookingHistoryScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _alertsKey, routes: [
        GoRoute(path: '/customer/notifications', builder: (_, __) => const NotificationCenterScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _profileKey, routes: [
        GoRoute(path: '/customer/profile', builder: (_, __) => const ProfileScreen()),
      ]),
    ],
  ),

  // Full-screen routes (root navigator) layered above the shell.
  GoRoute(path: '/customer/book', builder: (_, __) => const BookingFlowScreen()),
  GoRoute(path: '/customer/addresses', builder: (_, __) => const AddressListScreen()),
  GoRoute(path: '/customer/addresses/new', builder: (_, __) => const AddressFormScreen()),
  GoRoute(
    path: '/customer/addresses/:id/edit',
    builder: (_, state) => AddressFormScreen(existing: state.extra as Address?),
  ),
  GoRoute(
    path: '/customer/bookings/:id',
    builder: (_, state) => BookingDetailsScreen(bookingId: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/customer/bookings/:id/reschedule',
    builder: (_, state) => RescheduleScreen(bookingId: state.pathParameters['id']!),
  ),
  GoRoute(path: '/customer/subscriptions', builder: (_, __) => const SubscriptionListScreen()),
  GoRoute(
    path: '/customer/subscriptions/:id',
    builder: (_, state) => SubscriptionDetailScreen(subscriptionId: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/customer/bookings/:id/review',
    builder: (_, state) => ReviewScreen(bookingId: state.pathParameters['id']!),
  ),
];
