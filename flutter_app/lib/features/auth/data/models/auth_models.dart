// lib/features/auth/data/models/auth_models.dart
//
// Wire models. Parse the backend's snake_case envelope (access_token / refresh_token /
// user{id,email,role}). Kept tolerant (camelCase fallback) to survive minor drift.

import '../../domain/entities/auth_session.dart';
import '../../domain/entities/auth_user.dart';

class AuthUserModel {
  static AuthUser fromJson(Map<String, dynamic> json, {bool emailVerified = false}) {
    return AuthUser(
      id: (json['id'] ?? json['user_id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      fullName: json['full_name'] as String? ?? json['fullName'] as String?,
      emailVerified: emailVerified,
    );
  }
}

class AuthSessionModel {
  /// Accepts both the register (201) and login (200) shapes:
  /// { user:{...}, access_token, refresh_token }.
  static AuthSession fromJson(Map<String, dynamic> raw, {bool emailVerified = false}) {
    // Some endpoints wrap in { data: {...} }; unwrap defensively.
    final json = raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw;
    final access = (json['access_token'] ?? json['accessToken'])?.toString();
    final refresh = (json['refresh_token'] ?? json['refreshToken'])?.toString();
    final userJson = (json['user'] as Map<String, dynamic>?) ?? const {};
    if (access == null || refresh == null) {
      throw const FormatException('Missing tokens in auth response');
    }
    return AuthSession(
      accessToken: access,
      refreshToken: refresh,
      user: AuthUserModel.fromJson(userJson, emailVerified: emailVerified),
    );
  }
}
