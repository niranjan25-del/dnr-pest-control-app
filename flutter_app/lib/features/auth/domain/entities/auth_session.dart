// lib/features/auth/domain/entities/auth_session.dart
//
// The result of a successful backend token exchange: app JWTs + the user.

import 'auth_user.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });
}
