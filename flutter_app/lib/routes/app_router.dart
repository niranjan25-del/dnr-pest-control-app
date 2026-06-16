// lib/routes/app_router.dart
//
// INTEGRATION ROUTER — composes every feature's route list into one GoRouter and enforces
// the global guards. Replaces the foundation's placeholder router.
//
// Route groups:
//   • public/auth  → authRoutes (splash, onboarding, sign-in, register, reset, verify, profile-setup)
//   • customer     → customerRoutes (4-tab shell + booking/address/etc.)
//   • technician   → technicianRoutes (4-tab shell + job workflow/navigate/etc.)
//   • shared       → sharedRoutes (/chat, /track, /payments, /settings) — any authed role
//   • admin        → limited mobile notice (full admin is web)
//
// Guards (redirect):
//   1. session restoring → splash
//   2. first run + unauthenticated → onboarding
//   3. unauthenticated → sign-in
//   4. authenticated on an auth gate → role home
//   5. authenticated entering ANOTHER role's branch → own home (shared routes allowed)

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../app/admin_notice_screen.dart';
import '../app/analytics.dart';
import '../app/deep_links.dart';
import '../features/auth/presentation/auth_routes.dart';
import '../features/customer/customer_routes.dart';
import '../features/shared/shared_routes.dart';
import '../features/technician/technician_routes.dart';
import '../providers/auth_controller.dart';
import '../providers/core_providers.dart';
import 'app_routes.dart';

/// Role-branch prefixes used to block cross-role access.
const _roleBranchPrefixes = ['/customer', '/technician', '/admin'];

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);
  final prefs = ref.watch(preferencesServiceProvider);
  final analytics = ref.watch(analyticsProvider);
  final refresh = _AuthRefreshNotifier(ref);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    observers: [AnalyticsRouteObserver(analytics)],
    routes: [
      ...authRoutes,
      ...customerRoutes,
      ...technicianRoutes,
      ...sharedRoutes,
      GoRoute(path: AppRoutes.adminHome, builder: (_, __) => const AdminMobileNoticeScreen()),
    ],
    redirect: (context, state) {
      final loc = state.matchedLocation;

      // 1) Session still restoring -> hold on splash.
      if (auth.status == AuthStatus.unknown) {
        return loc == AppRoutes.splash ? null : AppRoutes.splash;
      }

      final loggedIn = auth.isAuthenticated;
      final onAuthPages = _isAuthPage(loc);

      // 2) + 3) Unauthenticated routing.
      if (!loggedIn) {
        if (!prefs.onboardingComplete && loc != AuthRoutes.onboarding && !_isAuthFlow(loc)) {
          return AuthRoutes.onboarding;
        }
        return onAuthPages ? null : AuthRoutes.signIn;
      }

      // 4) Authenticated but sitting on splash/sign-in/onboarding -> go home.
      final home = _homeForRole(auth.role);
      if (loc == AppRoutes.splash || loc == AuthRoutes.signIn || loc == AuthRoutes.onboarding) {
        return home;
      }

      // 5) Block entering another role's branch; shared/common routes are allowed.
      final otherBranch = _roleBranchPrefixes.firstWhere(
        (p) => loc.startsWith(p) && !home.startsWith(p),
        orElse: () => '',
      );
      if (otherBranch.isNotEmpty) return home;

      return null;
    },
  );
});

bool _isAuthPage(String loc) =>
    loc == AppRoutes.splash || loc == AuthRoutes.signIn || loc == AuthRoutes.onboarding;

/// Routes that are part of the unauthenticated auth flow (no redirect away from them).
bool _isAuthFlow(String loc) => const [
      '/sign-in',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/profile-setup',
    ].any(loc.startsWith);

String _homeForRole(AppRole role) {
  switch (role) {
    case AppRole.customer:
      return AppRoutes.customerHome;
    case AppRole.technician:
      return AppRoutes.technicianHome;
    case AppRole.admin:
      return AppRoutes.adminHome;
    case AppRole.unknown:
      return AuthRoutes.signIn;
  }
}

class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }
}
