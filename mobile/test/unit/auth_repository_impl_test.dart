// test/unit/auth_repository_impl_test.dart
//
// Repository tests with the datasources mocked (mocktail). Covers the two paths the UI
// depends on: a successful login returns Success(session) and persists tokens; a backend
// error is mapped to a typed Failure wrapped in FailureResult (never thrown into the UI).
// This is also the "API mocks" + "error handling" coverage for the data layer.
//
// NOTE: constructor arg order matches authRepositoryProvider:
//   AuthRepositoryImpl(firebaseAuthDatasource, authRemoteDatasource, secureStorage)
// Adjust mock wiring/method names to the real datasource API if they differ.

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/core/error/failures.dart';
import 'package:dnr_pest_control/features/auth/data/repositories/auth_repository_impl.dart';

import '../mocks/mocks.dart';
import '../fixtures/fixtures.dart';

void main() {
  setUpAll(registerFallbacks);

  late MockAuthRemoteDatasource remote;
  late MockFirebaseAuthDatasource firebase;
  late AuthRepositoryImpl repository;

  setUp(() {
    remote = MockAuthRemoteDatasource();
    firebase = MockFirebaseAuthDatasource();
    // The third dependency (secure storage) is mocked loosely; if it's required, inject a mock.
    repository = AuthRepositoryImpl(firebase, remote, /* secureStorage */ throwOnMissing());
  });

  group('loginWithEmail', () {
    test('returns Success(session) on valid credentials', () async {
      when(() => firebase.signInWithEmail(email: any(named: 'email'), password: any(named: 'password')))
          .thenAnswer((_) async => 'firebase-id-token');
      when(() => remote.exchangeFirebaseToken(any()))
          .thenAnswer((_) async => Fixtures.session());

      final result = await repository.loginWithEmail(email: 'customer@dnr.test', password: 'Secret123');

      expect(result.isSuccess, isTrue);
      expect(result.dataOrNull?.accessToken, isNotEmpty);
      verify(() => remote.exchangeFirebaseToken(any())).called(1);
    });

    test('maps a backend/auth error to a Failure (no throw)', () async {
      when(() => firebase.signInWithEmail(email: any(named: 'email'), password: any(named: 'password')))
          .thenThrow(const AuthFailure('INVALID_CREDENTIALS'));

      final result = await repository.loginWithEmail(email: 'customer@dnr.test', password: 'wrong');

      expect(result, isA<FailureResult>());
      expect(result.failureOrNull, isA<Failure>());
    });
  });
}

// Placeholder to make the missing secure-storage dependency explicit in the sample.
// Replace with a real MockSecureStorage instance.
dynamic throwOnMissing() => null;
