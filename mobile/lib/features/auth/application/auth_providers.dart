// lib/features/auth/application/auth_providers.dart
//
// Feature DI graph, composed from foundation providers (dio, secure storage). Controllers
// below depend on `authRepositoryProvider`. The global session lives in the foundation's
// `authControllerProvider`; controllers call it on success so GoRouter redirects.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/result.dart';
import '../../../providers/auth_controller.dart';
import '../../../providers/core_providers.dart';
import '../data/datasources/auth_remote_datasource.dart';
import '../data/datasources/firebase_auth_datasource.dart';
import '../data/repositories/auth_repository_impl.dart';
import '../domain/entities/auth_session.dart';
import '../domain/repositories/auth_repository.dart';

final firebaseAuthDatasourceProvider = Provider<FirebaseAuthDatasource>((ref) => FirebaseAuthDatasource());

final authRemoteDatasourceProvider =
    Provider<AuthRemoteDatasource>((ref) => AuthRemoteDatasource(ref.watch(dioProvider)));

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepositoryImpl(
      ref.watch(firebaseAuthDatasourceProvider),
      ref.watch(authRemoteDatasourceProvider),
      ref.watch(secureStorageProvider),
    ));

/// Helper: push a successful session into the global AuthController (which flips routing).
extension SessionCommit on Ref {
  Future<void> commitSession(AuthSession s) => read(authControllerProvider.notifier).setAuthenticated(
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        userId: s.user.id,
        role: s.user.role.toUpperCase(),
      );
}

/// Logout action usable from any screen (e.g. profile, app bar).
final logoutProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    final result = await ref.read(authRepositoryProvider).logout();
    // Regardless of server result, clear local session.
    if (result is FailureResult) {/* swallow: local logout still proceeds */}
    await ref.read(authControllerProvider.notifier).logout();
  };
});
