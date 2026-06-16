// lib/features/technician/technician_routes.dart
//
// Technician route tree for the foundation GoRouter. A StatefulShellRoute gives the 4-tab
// nav; job details, workflow, navigation, reports, and notifications are pushed full-screen
// above the shell.
//
// INTEGRATION (lib/routes/app_router.dart): replace the placeholder technicianHome route
// with `...technicianRoutes`. The redirect already gates these to authenticated TECHNICIANs.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dashboard/dashboard_screen.dart';
import 'jobs/job_screens.dart';
import 'jobs/job_workflow/job_workflow_screen.dart';
import 'navigation/navigation_screen.dart';
import 'notifications/notification_center_screen.dart';
import 'profile/profile_screen.dart';
import 'reports/report_history_screen.dart';
import 'schedule/schedule_screen.dart';
import 'technician_shell.dart';

final _todayKey = GlobalKey<NavigatorState>(debugLabel: 'tech-today');
final _jobsKey = GlobalKey<NavigatorState>(debugLabel: 'tech-jobs');
final _scheduleKey = GlobalKey<NavigatorState>(debugLabel: 'tech-schedule');
final _profileKey = GlobalKey<NavigatorState>(debugLabel: 'tech-profile');

final List<RouteBase> technicianRoutes = [
  StatefulShellRoute.indexedStack(
    builder: (_, __, shell) => TechnicianShell(shell: shell),
    branches: [
      StatefulShellBranch(navigatorKey: _todayKey, routes: [
        GoRoute(path: '/technician', builder: (_, __) => const TechnicianDashboardScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _jobsKey, routes: [
        GoRoute(path: '/technician/jobs', builder: (_, __) => const JobListScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _scheduleKey, routes: [
        GoRoute(path: '/technician/schedule', builder: (_, __) => const ScheduleScreen()),
      ]),
      StatefulShellBranch(navigatorKey: _profileKey, routes: [
        GoRoute(path: '/technician/profile', builder: (_, __) => const TechnicianProfileScreen()),
      ]),
    ],
  ),

  // Full-screen routes above the shell.
  GoRoute(path: '/technician/notifications', builder: (_, __) => const TechnicianNotificationsScreen()),
  GoRoute(path: '/technician/reports', builder: (_, __) => const ReportHistoryScreen()),
  GoRoute(path: '/technician/jobs/:id', builder: (_, s) => JobDetailsScreen(bookingId: s.pathParameters['id']!)),
  GoRoute(path: '/technician/jobs/:id/workflow', builder: (_, s) => JobWorkflowScreen(bookingId: s.pathParameters['id']!)),
  GoRoute(path: '/technician/jobs/:id/navigate', builder: (_, s) => NavigationScreen(bookingId: s.pathParameters['id']!)),
];
