// lib/core/error/app_exception.dart
//
// Transport/data-layer exceptions. Thrown by services, caught by repositories, and
// converted to Failures via FailureMapper. UI never sees these directly.

class AppException implements Exception {
  final String message;
  final String? code;
  const AppException(this.message, {this.code});
  @override
  String toString() => 'AppException($code): $message';
}

class ApiException extends AppException {
  final int? statusCode;
  final Map<String, dynamic>? details;
  final String? requestId;
  const ApiException(super.message, {this.statusCode, this.details, this.requestId, super.code});
}

class NetworkException extends AppException {
  const NetworkException([super.message = 'No internet connection']) : super(code: 'NETWORK');
}

class TimeoutException extends AppException {
  const TimeoutException([super.message = 'Request timed out']) : super(code: 'TIMEOUT');
}

class UnauthorizedException extends AppException {
  const UnauthorizedException([super.message = 'Unauthorized']) : super(code: 'UNAUTHORIZED');
}

class CacheException extends AppException {
  const CacheException([super.message = 'Cache error']) : super(code: 'CACHE');
}
