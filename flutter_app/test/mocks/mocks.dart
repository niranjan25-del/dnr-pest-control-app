// test/mocks/mocks.dart
//
// Central mocktail mocks for every collaborator tests need to fake: the auth repository +
// its datasources, Dio, secure storage, GoRouter, and Firebase Messaging. Mocktail needs no
// codegen — just `class MockX extends Mock implements X`. `registerFallbacks()` registers
// fallback values for any custom types passed to `any()`/`captureAny()` matchers.

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/dio_client.dart';
import 'package:dnr_pest_control/features/auth/domain/repositories/auth_repository.dart';
import 'package:dnr_pest_control/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:dnr_pest_control/features/auth/data/datasources/firebase_auth_datasource.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

class MockAuthRemoteDatasource extends Mock implements AuthRemoteDatasource {}

class MockFirebaseAuthDatasource extends Mock implements FirebaseAuthDatasource {}

class MockDio extends Mock implements Dio {}

class MockGoRouter extends Mock implements GoRouter {}

class MockFirebaseMessaging extends Mock implements FirebaseMessaging {}

/// SecureStorage is a thin app wrapper; mock by interface. Adjust the import/type to the
/// real class exposed by `secureStorageProvider`.
// class MockSecureStorage extends Mock implements SecureStorage {}

/// Register fallback values for custom types used with mocktail matchers (`any()`).
/// Call once in a test's `setUpAll`.
void registerFallbacks() {
  registerFallbackValue(RequestOptions(path: '/'));
  registerFallbackValue(Uri.parse('/'));
}
