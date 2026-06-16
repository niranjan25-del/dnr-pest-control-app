// integration_test/auth_flow_test.dart
//
// End-to-end authentication flow driven through the real router + screens, with the network
// boundary mocked (authRepositoryProvider). Proves: unauthenticated start → sign-in screen →
// valid login → session committed → redirect away from sign-in into the customer area.
//
// On-device runs (`flutter test integration_test`) initialize real Firebase; here we mock the
// repository so the flow is hermetic. FLAG: override secureStorage/preferences/analytics with
// fakes as needed so the router's providers construct cleanly in the test environment.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/features/auth/application/auth_providers.dart';
import 'package:dnr_pest_control/routes/app_router.dart';
import 'package:dnr_pest_control/routes/app_routes.dart';

import '../test/mocks/mocks.dart';
import '../test/fixtures/fixtures.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(registerFallbacks);

  testWidgets('login flow authenticates and leaves the sign-in screen', (tester) async {
    final repo = MockAuthRepository();
    when(() => repo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => Success(Fixtures.session()));

    late ProviderContainer container;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
        child: Consumer(builder: (context, ref, _) {
          container = ProviderScope.containerOf(context);
          return MaterialApp.router(routerConfig: ref.watch(routerProvider));
        }),
      ),
    );
    await tester.pumpAndSettle();

    // Starts unauthenticated → sign-in.
    final router = container.read(routerProvider);
    expect(router.routerDelegate.currentConfiguration.uri.toString(), AppRoutes.signIn);

    // Fill + submit.
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'customer@dnr.test');
    await tester.enterText(fields.at(1), 'Secret123');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    verify(() => repo.loginWithEmail(email: 'customer@dnr.test', password: 'Secret123')).called(1);
    // After a committed session the guard redirects off the sign-in route.
    expect(router.routerDelegate.currentConfiguration.uri.toString(), isNot(AppRoutes.signIn));
  });
}
