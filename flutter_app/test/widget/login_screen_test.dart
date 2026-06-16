// test/widget/login_screen_test.dart
//
// Widget test for LoginScreen. Verifies (1) form validation blocks submit when fields are
// empty/invalid — the repository is never called — and (2) valid input triggers a login and
// shows the loading state. authRepositoryProvider is mocked so the real controller runs but
// no network happens.

import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/features/auth/application/auth_providers.dart';
import 'package:dnr_pest_control/features/auth/presentation/screens/login_screen.dart';

import '../mocks/mocks.dart';
import '../fixtures/fixtures.dart';
import '../helpers/harness.dart';

void main() {
  setUpAll(registerFallbacks);

  late MockAuthRepository repo;
  setUp(() => repo = MockAuthRepository());

  Future<void> pumpLogin(WidgetTester tester) => pumpApp(
        tester,
        const LoginScreen(),
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
      );

  testWidgets('does not submit when fields are empty (validation blocks)', (tester) async {
    await pumpLogin(tester);

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    verifyNever(() => repo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')));
  });

  testWidgets('submits valid credentials and shows loading', (tester) async {
    final completer = Completer<Result<dynamic>>();
    when(() => repo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) => completer.future as Future);

    await pumpLogin(tester);

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'customer@dnr.test');
    await tester.enterText(fields.at(1), 'Secret123');
    await tester.tap(find.text('Sign in'));
    await tester.pump(); // enter submitting state (future still pending)

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    verify(() => repo.loginWithEmail(email: 'customer@dnr.test', password: 'Secret123')).called(1);

    completer.complete(Success(Fixtures.session()));
    await tester.pumpAndSettle();
  });
}
