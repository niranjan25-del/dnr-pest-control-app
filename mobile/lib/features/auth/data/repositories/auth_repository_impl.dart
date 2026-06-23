// lib/features/auth/data/repositories/auth_repository_impl.dart
//
// Orchestrates Firebase (IdP) + backend (app JWTs) and the secure-storage/session side
// effects. Every method is wrapped so transport errors become domain Failures via
// FailureMapper and are returned as Result<T>.

import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../../../../services/secure_storage_service.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../datasources/firebase_auth_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final FirebaseAuthDatasource _firebase;
  final AuthRemoteDatasource _remote;
  final SecureStorageService _storage;

  AuthRepositoryImpl(this._firebase, this._remote, this._storage);

  Future<Result<T>> _guard<T>(Future<T> Function() run) async {
    try {
      return Success(await run());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<void> _persist(AuthSession s) =>
      _storage.saveTokens(accessToken: s.accessToken, refreshToken: s.refreshToken);

  @override
  Future<Result<AuthSession>> loginWithEmail({required String email, required String password}) =>
      _guard(() async {
        try {
          final idToken = await _firebase.signInEmail(email: email, password: password);
          final verified = await _firebase.reloadEmailVerified();
          final session = await _remote.login(firebaseIdToken: idToken, emailVerified: verified);
          await _persist(session);
          return session;
        } catch (_) {
          // Fallback for backend-only accounts that are not provisioned in Firebase
          // but still authenticate through the app's email/password endpoint.
          final session = await _remote.loginWithCredentials(email: email, password: password);
          await _persist(session);
          return session;
        }
      });

  @override
  Future<Result<AuthSession>> loginWithGoogle() => _guard(() async {
        final idToken = await _firebase.signInGoogle();
        final session = await _remote.login(firebaseIdToken: idToken, provider: 'google', emailVerified: true);
        await _persist(session);
        return session;
      });

  @override
  Future<Result<AuthSession>> loginWithApple() => _guard(() async {
        final idToken = await _firebase.signInApple();
        final session = await _remote.login(firebaseIdToken: idToken, provider: 'apple', emailVerified: true);
        await _persist(session);
        return session;
      });

  @override
  Future<Result<void>> registerFirebaseUser({
    required String email,
    required String password,
    required String fullName,
  }) =>
      _guard(() async {
        await _firebase.signUpEmail(email: email, password: password, fullName: fullName);
      });

  @override
  Future<Result<AuthSession>> completeRegistration({
    required String fullName,
    required String phone,
    required CustomerType customerType,
  }) =>
      _guard(() async {
        final idToken = await _firebase.currentIdToken();
        final verified = await _firebase.reloadEmailVerified();
        final session = await _remote.register(
          firebaseIdToken: idToken,
          fullName: fullName,
          phone: phone,
          customerType: customerType == CustomerType.commercial ? 'COMMERCIAL' : 'RESIDENTIAL',
          emailVerified: verified,
        );
        await _persist(session);
        return session;
      });

  @override
  Future<Result<void>> sendPasswordReset(String email) => _guard(() => _firebase.sendPasswordReset(email));

  @override
  Future<Result<void>> confirmPasswordReset({required String code, required String newPassword}) =>
      _guard(() => _firebase.confirmPasswordReset(code: code, newPassword: newPassword));

  @override
  Future<Result<void>> resendEmailVerification() => _guard(() => _firebase.sendEmailVerification());

  @override
  Future<Result<bool>> refreshEmailVerified() => _guard(() => _firebase.reloadEmailVerified());

  @override
  Future<Result<AuthUser>> fetchCurrentUser() => _guard(() => _remote.me());

  @override
  Future<Result<void>> logout() => _guard(() async {
        final refresh = await _storage.readRefreshToken();
        if (refresh != null && refresh.isNotEmpty) {
          // Best-effort server revoke; ignore failures so local logout always proceeds.
          try {
            await _remote.logout(refresh);
          } catch (_) {}
        }
        await _firebase.signOut();
      });
}
