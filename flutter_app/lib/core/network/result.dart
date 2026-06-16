// lib/core/network/result.dart
//
// A lightweight Result<T> = Success | FailureResult, so repositories return typed
// outcomes instead of throwing into the UI. Pattern-match with `when`.

import '../error/failures.dart';

sealed class Result<T> {
  const Result();

  R when<R>({
    required R Function(T data) success,
    required R Function(Failure failure) failure,
  }) {
    final self = this;
    if (self is Success<T>) return success(self.data);
    return failure((self as FailureResult<T>).failure);
  }

  bool get isSuccess => this is Success<T>;
  T? get dataOrNull => this is Success<T> ? (this as Success<T>).data : null;
  Failure? get failureOrNull => this is FailureResult<T> ? (this as FailureResult<T>).failure : null;
}

class Success<T> extends Result<T> {
  final T data;
  const Success(this.data);
}

class FailureResult<T> extends Result<T> {
  final Failure failure;
  const FailureResult(this.failure);
}
