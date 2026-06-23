// lib/core/network/dio_client.dart
//
// Builds the configured Dio instance: base URL, timeouts, common headers, the auth
// interceptor (token attach + refresh), a light retry for transient network errors, and
// pretty logging in non-prod. This is the single HTTP client used by all repositories.

import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import '../constants/app_constants.dart';
import '../../config/app_environment.dart';
import '../../services/secure_storage_service.dart';
import 'auth_interceptor.dart';

class DioClient {
  static Dio create({
    required AppEnvironment env,
    required SecureStorageService storage,
    required void Function() onSessionExpired,
    String? appVersion,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: env.apiBaseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          if (appVersion != null) 'X-App-Version': appVersion,
          'X-Platform': 'mobile',
        },
        // Treat only <400 as success; everything else flows through onError → FailureMapper.
        validateStatus: (s) => s != null && s < 400,
      ),
    );

    dio.interceptors.add(
      AuthInterceptor(storage: storage, env: env, onSessionExpired: onSessionExpired),
    );

    // Light retry for transient connectivity/timeout (idempotent GETs only).
    dio.interceptors.add(_RetryInterceptor(dio));

    if (env.enableLogging) {
      dio.interceptors.add(PrettyDioLogger(
        requestHeader: false,
        requestBody: true,
        responseBody: false,
        compact: true,
      ));
    }

    return dio;
  }
}

class _RetryInterceptor extends Interceptor {
  final Dio _dio;
  _RetryInterceptor(this._dio);

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final retriable = err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout;
    final isGet = err.requestOptions.method.toUpperCase() == 'GET';
    final attempts = (err.requestOptions.extra['retryCount'] as int?) ?? 0;

    if (retriable && isGet && attempts < AppConstants.maxRetries) {
      final next = attempts + 1;
      await Future<void>.delayed(Duration(milliseconds: 300 * next));
      final opts = err.requestOptions..extra['retryCount'] = next;
      try {
        return handler.resolve(await _dio.fetch(opts));
      } catch (_) {/* fall through */}
    }
    handler.next(err);
  }
}
