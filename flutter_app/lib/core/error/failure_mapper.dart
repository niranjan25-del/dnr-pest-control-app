// lib/core/error/failure_mapper.dart
//
// Single place that turns transport errors (DioException, AppException) into domain
// Failures, reading the backend error envelope { error: { code, message, details,
// request_id } }. Repositories call this in their catch blocks.

import 'package:dio/dio.dart';
import 'app_exception.dart';
import 'failures.dart';

class FailureMapper {
  FailureMapper._();

  static Failure map(Object error) {
    if (error is Failure) return error;
    if (error is DioException) return _fromDio(error);
    if (error is UnauthorizedException) return const UnauthorizedFailure();
    if (error is NetworkException) return const NetworkFailure();
    if (error is TimeoutException) return const TimeoutFailure();
    if (error is ApiException) {
      return ServerFailure(error.message, statusCode: error.statusCode, code: error.code);
    }
    if (error is CacheException) return CacheFailure(error.message);
    return const UnknownFailure();
  }

  static Failure _fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutFailure();
      case DioExceptionType.connectionError:
        return const NetworkFailure();
      case DioExceptionType.cancel:
        return const UnknownFailure('Request cancelled');
      default:
        break;
    }

    final status = e.response?.statusCode;
    final envelope = _envelope(e.response?.data);
    final message = envelope?['message'] as String?;
    final code = envelope?['code'] as String?;
    final details = envelope?['details'] as Map<String, dynamic>?;

    switch (status) {
      case 400:
      case 422:
        return ValidationFailure(message ?? 'Invalid request', details: details, code: code);
      case 401:
        return UnauthorizedFailure(message ?? 'Session expired. Please sign in again.');
      case 403:
        return ForbiddenFailure(message ?? 'Access denied.');
      case 404:
        return NotFoundFailure(message ?? 'Not found.');
      case 409:
        return ServerFailure(message ?? 'Conflict.', statusCode: 409, code: code);
      default:
        if (status != null && status >= 500) {
          return ServerFailure(message ?? 'Server error. Please try again.', statusCode: status, code: code);
        }
        return UnknownFailure(message ?? 'Something went wrong.');
    }
  }

  /// Extract the `error` object from the standard envelope, tolerating other shapes.
  static Map<String, dynamic>? _envelope(dynamic data) {
    if (data is Map<String, dynamic>) {
      final err = data['error'];
      if (err is Map<String, dynamic>) return err;
      if (data['message'] is String) return {'message': data['message']};
    }
    return null;
  }
}
