// lib/features/auth/application/submission_state.dart
//
// A tiny, reusable async-submission state for forms: idle → submitting → success|failure.
// Carries the Failure so screens can show inline/snackbar errors.

import '../../../core/error/failures.dart';

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
