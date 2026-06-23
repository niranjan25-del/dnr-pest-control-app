// lib/core/error/failures.dart
//
// User-facing failure types. Exceptions (transport-level) are mapped to Failures
// (domain-level) at the data-layer boundary so the UI only ever handles Failures.
// `code` mirrors the backend error envelope { error: { code, message, ... } }.

sealed class Failure {
  final String message;
  final String? code;
  const Failure(this.message, {this.code});

  @override
  String toString() => 'Failure($code): $message';
}

class NetworkFailure extends Failure {
  const NetworkFailure([String message = 'No internet connection']) : super(message, code: 'NETWORK');
}

class TimeoutFailure extends Failure {
  const TimeoutFailure([String message = 'The request timed out']) : super(message, code: 'TIMEOUT');
}

class ServerFailure extends Failure {
  final int? statusCode;
  const ServerFailure(String message, {this.statusCode, String? code}) : super(message, code: code);
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure([String message = 'Session expired. Please sign in again.'])
      : super(message, code: 'UNAUTHORIZED');
}

class ForbiddenFailure extends Failure {
  const ForbiddenFailure([String message = 'You do not have access to this resource.'])
      : super(message, code: 'FORBIDDEN');
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([String message = 'Not found.']) : super(message, code: 'NOT_FOUND');
}

class ValidationFailure extends Failure {
  final Map<String, dynamic>? details;
  const ValidationFailure(String message, {this.details, String? code}) : super(message, code: code ?? 'VALIDATION');
}

class CacheFailure extends Failure {
  const CacheFailure([String message = 'Local data error']) : super(message, code: 'CACHE');
}

class PermissionFailure extends Failure {
  const PermissionFailure([String message = 'Permission denied.']) : super(message, code: 'PERMISSION');
}

class UnknownFailure extends Failure {
  const UnknownFailure([String message = 'Something went wrong. Please try again.']) : super(message, code: 'UNKNOWN');
}
