// test/widget/register_screen_test.dart
//
// Widget test for RegisterScreen focusing on form validation — specifically the
// confirm-password rule (must equal password). A mismatch must block submission, so the
// repository's registration call is never made.
//
// Field order on screen: Full name, Email, Password, Confirm password.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/features/auth/application/auth_providers.dart';
import 'package:dnr_pest_control/features/auth/presentation/screens/register_screen.dart';

import '../mocks/mocks.dart';
import '../helpers/harness.dart';

void main() {
  setUpAll(registerFallbacks);

  late MockAuthRepository repo;
  setUp(() => repo = MockAuthRepository());

  Future<void> pumpRegister(WidgetTester tester) => pumpApp(
        tester,
        const RegisterScreen(),
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
      );

  testWidgets('blocks submit when passwords do not match', (tester) async {
    await pumpRegister(tester);

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Asha Rao');        // full name
    await tester.enterText(fields.at(1), 'asha@dnr.test');   // email
    await tester.enterText(fields.at(2), 'Secret123');       // password
    await tester.enterText(fields.at(3), 'Different999');    // confirm (mismatch)

    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();

    verifyNever(() => repo.registerFirebaseUser(
          email: any(named: 'email'),
          password: any(named: 'password'),
          fullName: any(named: 'fullName'),
        ));
  });
}
