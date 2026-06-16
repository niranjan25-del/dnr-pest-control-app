// lib/core/network/auth_interceptor.dart
//
// Attaches the access token to every request and transparently refreshes on 401 using
// the rotating refresh token (matches the backend's refresh-token rotation). Concurrent
// 401s are coalesced into a single refresh; on refresh failure the session is cleared
// and a logout signal is emitted so the router can redirect to sign-in.
//
// Uses a SEPARATE Dio instance for the refresh call to avoid interceptor recursion.

import 'dart:async';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../../services/secure_storage_service.dart';
import '../../config/app_environment.dart';

class AuthInterceptor extends QueuedInterceptor {
  final SecureStorageService _storage;
  final AppEnvironment _env;
  final void Function() _onSessionExpired;
  final Dio _refreshDio;

  AuthInterceptor({
    required SecureStorageService storage,
    required AppEnvironment env,
    required void Function() onSessionExpired,
  })  : _storage = storage,
        _env = env,
        _onSessionExpired = onSessionExpired,
        _refreshDio = Dio(BaseOptions(baseUrl: env.apiBaseUrl));

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] != true) {
      final token = await _storage.readAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers[AppConstants.accessTokenHeader] = '${AppConstants.bearerPrefix}$token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isAuthError = err.response?.statusCode == 401;
    final isRefreshCall = err.requestOptions.path.contains(AppConstants.refreshPath);
    final alreadyRetried = err.requestOptions.extra['retried'] == true;

    if (!isAuthError || isRefreshCall || alreadyRetried) {
      return handler.next(err);
    }

    final newToken = await _tryRefresh();
    if (newToken == null) {
      await _storage.clear();
      _onSessionExpired();
      return handler.next(err);
    }

    // Retry the original request once with the new token.
    final req = err.requestOptions
      ..headers[AppConstants.accessTokenHeader] = '${AppConstants.bearerPrefix}$newToken'
      ..extra['retried'] = true;
    try {
      final response = await _refreshDio.fetch(req);
      return handler.resolve(response);
    } catch (_) {
      return handler.next(err);
    }
  }

  Future<String?> _tryRefresh() async {
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final res = await _refreshDio.post(
        AppConstants.refreshPath,
        data: {'refreshToken': refreshToken},
        options: Options(extra: {'skipAuth': true}),
      );
      final data = res.data is Map<String, dynamic> ? res.data['data'] ?? res.data : res.data;
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?; // rotation: new refresh token issued
      if (access == null) return null;
      await _storage.saveTokens(accessToken: access, refreshToken: refresh ?? refreshToken);
      return access;
    } catch (_) {
      return null;
    }
  }
}
