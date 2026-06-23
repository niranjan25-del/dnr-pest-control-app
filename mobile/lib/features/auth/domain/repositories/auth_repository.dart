// lib/features/auth/domain/repositories/auth_repository.dart
//
// Repository contract. Presentation/application depend on THIS, not on Firebase or Dio.
// Every method returns Result<T> — failures are domain Failures, never thrown.

import '../../../../core/network/result.dart';
import '../entities/auth_session.dart';
import '../entities/auth_user.dart';

enum CustomerType { residential, commercial }

abstract interface class AuthRepository {
  /// Email/password sign-in: Firebase auth → exchange ID token for app JWTs.
  Future<Result<AuthSession>> loginWithEmail({required String email, required String password});

  /// Social sign-in (Google/Apple) → exchange Firebase ID token for app JWTs.
  Future<Result<AuthSession>> loginWithGoogle();
  Future<Result<AuthSession>> loginWithApple();

  /// Step 1 of registration: create the Firebase user + send verification email.
  /// Returns nothing persistent yet (backend provisioning happens in [completeRegistration]).
  Future<Result<void>> registerFirebaseUser({
    required String email,
    required String password,
    required String fullName,
  });

  /// Step 2 of registration: provision the backend User/profile from the current
  /// Firebase session and receive app JWTs.
  Future<Result<AuthSession>> completeRegistration({
    required String fullName,
    required String phone,
    required CustomerType customerType,
  });

  /// Firebase-delegated password reset (sends the email).
  Future<Result<void>> sendPasswordReset(String email);

  /// Complete a reset from an emailed deep-link code (Firebase confirmPasswordReset).
  Future<Result<void>> confirmPasswordReset({required String code, required String newPassword});

  /// Email verification (Firebase): resend + refresh status.
  Future<Result<void>> resendEmailVerification();
  Future<Result<bool>> refreshEmailVerified();

  /// Validate/restore the current session against the backend (GET /auth/me).
  Future<Result<AuthUser>> fetchCurrentUser();

  /// Revoke the refresh token server-side + sign out of Firebase.
  Future<Result<void>> logout();
}
