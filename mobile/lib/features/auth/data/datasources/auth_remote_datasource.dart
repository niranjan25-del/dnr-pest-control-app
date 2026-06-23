// lib/features/auth/data/datasources/auth_remote_datasource.dart
//
// Backend auth calls (the app-JWT exchange). Uses the shared Dio (foundation). These
// endpoints take a Firebase ID token and return app access/refresh tokens. `skipAuth`
// keeps the auth interceptor from attaching a (not-yet-existent) bearer token.

import 'package:dio/dio.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/auth_user.dart';
import '../models/auth_models.dart';

class AuthRemoteDatasource {
  final Dio _dio;
  AuthRemoteDatasource(this._dio);

  static const _opts = Options(extra: {'skipAuth': true});

  Future<AuthSession> register({
    required String firebaseIdToken,
    required String fullName,
    required String phone,
    required String customerType,
    bool emailVerified = false,
  }) async {
    final res = await _dio.post('/auth/register', options: _opts, data: {
      'firebase_id_token': firebaseIdToken,
      'full_name': fullName,
      'phone': phone,
      'customer_type': customerType,
    });
    return AuthSessionModel.fromJson(res.data as Map<String, dynamic>, emailVerified: emailVerified);
  }

  Future<AuthSession> login({
    required String firebaseIdToken,
    String? provider,
    bool emailVerified = false,
  }) async {
    final res = await _dio.post('/auth/firebase-login', options: _opts, data: {
      'idToken': firebaseIdToken,
      if (provider != null) 'provider': provider,
    });
    return AuthSessionModel.fromJson(res.data as Map<String, dynamic>, emailVerified: emailVerified);
  }

  Future<AuthSession> loginWithCredentials({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post('/auth/login', options: _opts, data: {
      'email': email,
      'password': password,
    });
    return AuthSessionModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post('/auth/logout', data: {'refresh_token': refreshToken});
  }

  Future<AuthUser> me() async {
    final res = await _dio.get('/auth/me');
    final raw = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : <String, dynamic>{};
    final json = raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw;
    final userJson = (json['user'] as Map<String, dynamic>?) ?? json;
    return AuthUserModel.fromJson(userJson);
  }
}
