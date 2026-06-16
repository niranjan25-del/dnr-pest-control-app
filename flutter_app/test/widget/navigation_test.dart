// test/widget/navigation_test.dart
//
// Navigation guard tests: the router (routerProvider) redirects based on authControllerProvider.
// We stub the auth controller so we can assert the redirect decision without bootstrapping
// real secure storage. Asserts on the resolved router location, so it doesn't depend on
// screen internals.
//
// FLAG: routerProvider also reads preferencesServiceProvider + analyticsProvider. If those
// touch platform channels, override them with fakes here too (add to `overrides`).

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:dnr_pest_control/providers/auth_controller.dart';
import 'package:dnr_pest_control/routes/app_router.dart';
import 'package:dnr_pest_control/routes/app_routes.dart';

import '../helpers/harness.dart';

/// Minimal AuthController stub: holds a fixed AuthState; unused members route via noSuchMethod.
class _StubAuthController extends StateNotifier<AuthState> implements AuthController {
  _StubAuthController(super.state);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Override _withAuth(AuthState state) =>
    authControllerProvider.overrideWith((ref) => _StubAuthController(state));

String _location(GoRouter router) =>
    router.routerDelegate.currentConfiguration.uri.toString();

void main() {
  testWidgets('unauthenticated user is redirected to sign-in', (tester) async {
    final container = createContainer(overrides: [
      _withAuth(const AuthState(status: AuthStatus.unauthenticated, role: AppRole.unknown)),
    ]);
    final router = container.read(routerProvider);

    await pumpRouterApp(tester, router);

    expect(_location(router), AppRoutes.signIn);
  });

  testWidgets('authenticated customer lands on the customer home', (tester) async {
    final container = createContainer(overrides: [
      _withAuth(const AuthState(status: AuthStatus.authenticated, role: AppRole.customer, userId: 'u1')),
    ]);
    final router = container.read(routerProvider);

    await pumpRouterApp(tester, router);

    expect(_location(router), startsWith(AppRoutes.customerHome));
  });
}
