// lib/shared/state/submission_state.dart
//
// Reusable async-submission state for forms/actions (idle → submitting → success|failure).
// Shared across features so each one doesn't reinvent it.

import '../../core/error/failures.dart';

enum SubmissionStatus { idle, submitting, success, failure }

class SubmissionState {
  final SubmissionStatus status;
  final Failure? failure;
  const SubmissionState({this.status = SubmissionStatus.idle, this.failure});

  bool get isSubmitting => status == SubmissionStatus.submitting;
  bool get isSuccess => status == SubmissionStatus.success;
  bool get isFailure => status == SubmissionStatus.failure;

  const SubmissionState.idle() : this();
  const SubmissionState.submitting() : this(status: SubmissionStatus.submitting);
  const SubmissionState.success() : this(status: SubmissionStatus.success);
  const SubmissionState.error(Failure failure) : this(status: SubmissionStatus.failure, failure: failure);
}
