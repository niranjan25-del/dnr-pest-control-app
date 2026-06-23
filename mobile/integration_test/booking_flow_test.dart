// integration_test/booking_flow_test.dart
//
// Customer booking flow scaffold: authenticated customer → open "new booking" → pick a
// service → choose a slot → confirm → booking repository receives the create call. The
// network boundary is mocked so the flow is deterministic.
//
// FLAG: the step finders below (button labels / field keys for the customer booking screens)
// must be matched to the real customer-feature widgets. Add `Key`s to those widgets to make
// these steps robust. The structure + assertions are the contract; selectors are the
// per-screen detail to confirm.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/features/auth/application/auth_providers.dart';
import 'package:dnr_pest_control/providers/auth_controller.dart';
import 'package:dnr_pest_control/routes/app_router.dart';

import '../test/mocks/mocks.dart';
import '../test/fixtures/fixtures.dart';

// A booking repository mock — replace the type with the app's real BookingRepository.
// class MockBookingRepository extends Mock implements BookingRepository {}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(registerFallbacks);

  testWidgets('customer creates a booking end to end', (tester) async {
    final authRepo = MockAuthRepository();
    when(() => authRepo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => Success(Fixtures.session()));

    late ProviderContainer container;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(authRepo),
          // bookingRepositoryProvider.overrideWithValue(bookingRepo),  // ← wire the real provider
        ],
        child: Consumer(builder: (context, ref, _) {
          container = ProviderScope.containerOf(context);
          return MaterialApp.router(routerConfig: ref.watch(routerProvider));
        }),
      ),
    );
    await tester.pumpAndSettle();

    // Authenticate as a customer (drives the router into the customer area).
    container.read(authControllerProvider.notifier).setAuthenticated(role: 'CUSTOMER', userId: 'u1');
    await tester.pumpAndSettle();

    // --- Booking steps (match these finders to the real customer screens) ---
    // await tester.tap(find.byKey(const Key('newBookingButton')));
    // await tester.pumpAndSettle();
    // await tester.tap(find.text('General Pest Control'));
    // await tester.tap(find.byKey(const Key('slot-0')));
    // await tester.tap(find.text('Confirm booking'));
    // await tester.pumpAndSettle();

    // --- Assertion ---
    // verify(() => bookingRepo.createBooking(any())).called(1);

    expect(find.byType(MaterialApp), findsOneWidget); // placeholder until finders are wired
  }, skip: true); // unskip once booking-screen finders/keys are in place
}
