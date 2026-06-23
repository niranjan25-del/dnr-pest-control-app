// lib/providers/auth_controller.dart
//
// App-wide authentication state (the router's source of truth for redirects). The
// FOUNDATION ships the state machine + session bootstrap (read tokens on launch) and a
// logout/session-expired path. The actual sign-in calls live in the auth FEATURE later
// and will call `setAuthenticated(...)` here.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/constants/app_constants.dart';
import '../services/secure_storage_service.dart';
import 'core_providers.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final AppRole role;
  final String? userId;
  const AuthState({this.status = AuthStatus.unknown, this.role = AppRole.unknown, this.userId});

  AuthState copyWith({AuthStatus? status, AppRole? role, String? userId}) =>
      AuthState(status: status ?? this.status, role: role ?? this.role, userId: userId ?? this.userId);

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

class AuthController extends StateNotifier<AuthState> {
  final SecureStorageService _storage;
  AuthController(this._storage) : super(const AuthState()) {
    _restore();
  }

  /// On launch, hydrate session from secure storage (token presence = optimistic auth;
  /// the first authed request validates it, and a 401 cleanly logs out).
  Future<void> _restore() async {
    final token = await _storage.readAccessToken();
    if (token == null || token.isEmpty) {
      state = state.copyWith(status: AuthStatus.unauthenticated, role: AppRole.unknown);
      return;
    }
    final role = appRoleFromString(await _storage.readRole());
    final userId = await _storage.readUserId();
    state = AuthState(status: AuthStatus.authenticated, role: role, userId: userId);
  }

  /// Called by the auth feature after a successful login/token exchange.
  Future<void> setAuthenticated({
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String role,
  }) async {
    await _storage.saveTokens(accessToken: accessToken, refreshToken: refreshToken);
    await _storage.saveSession(userId: userId, role: role);
    state = AuthState(status: AuthStatus.authenticated, role: appRoleFromString(role), userId: userId);
  }

  Future<void> logout() async {
    await _storage.clear();
    state = const AuthState(status: AuthStatus.unauthenticated, role: AppRole.unknown);
  }

  /// Invoked by the Dio auth interceptor when a refresh ultimately fails.
  void onSessionExpired() {
    state = const AuthState(status: AuthStatus.unauthenticated, role: AppRole.unknown);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref.watch(secureStorageProvider)));
