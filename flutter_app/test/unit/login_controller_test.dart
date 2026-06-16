// test/unit/login_controller_test.dart
//
// State-management test for the Riverpod LoginController (StateNotifier<SubmissionState>).
// We override authRepositoryProvider with a mock and assert the state machine:
// idle → submitting → success | failure. Listening to the provider records the sequence.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/core/error/failures.dart';
import 'package:dnr_pest_control/features/auth/application/auth_providers.dart';
import 'package:dnr_pest_control/features/auth/application/login_controller.dart';
import 'package:dnr_pest_control/features/auth/application/submission_state.dart';

import '../mocks/mocks.dart';
import '../fixtures/fixtures.dart';
import '../helpers/harness.dart';

void main() {
  setUpAll(registerFallbacks);

  late MockAuthRepository repo;

  setUp(() => repo = MockAuthRepository());

  ProviderContainer containerWithRepo() =>
      createContainer(overrides: [authRepositoryProvider.overrideWithValue(repo)]);

  test('emits submitting then success on valid login', () async {
    when(() => repo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => Success(Fixtures.session()));

    final container = containerWithRepo();
    final states = <SubmissionStatus>[];
    container.listen<SubmissionState>(loginControllerProvider, (_, next) => states.add(next.status), fireImmediately: true);

    await container.read(loginControllerProvider.notifier).loginEmail(email: 'customer@dnr.test', password: 'Secret123');

    expect(states.first, SubmissionStatus.idle);
    expect(states, contains(SubmissionStatus.submitting));
    expect(states.last, SubmissionStatus.success);
  });

  test('emits failure and carries the Failure on bad login', () async {
    when(() => repo.loginWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => const FailureResult(AuthFailure('INVALID_CREDENTIALS')));

    final container = containerWithRepo();
    await container.read(loginControllerProvider.notifier).loginEmail(email: 'customer@dnr.test', password: 'wrong');

    final state = container.read(loginControllerProvider);
    expect(state.status, SubmissionStatus.failure);
    expect(state.failure, isA<Failure>());
  });
}
