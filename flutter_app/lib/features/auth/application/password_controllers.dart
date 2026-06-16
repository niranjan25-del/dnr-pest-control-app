// lib/features/auth/application/password_controllers.dart
//
// Forgot-password (Firebase sends the reset email), reset-password (confirm from an
// emailed deep-link code), and email-verification controllers.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_providers.dart';
import 'submission_state.dart';

class ForgotPasswordController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  ForgotPasswordController(this._ref) : super(const SubmissionState.idle());

  Future<void> submit(String email) async {
    state = const SubmissionState.submitting();
    final result = await _ref.read(authRepositoryProvider).sendPasswordReset(email.trim());
    result.when(
      success: (_) => state = const SubmissionState.success(),
      failure: (f) => state = SubmissionState.error(f),
    );
  }
}

class ResetPasswordController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  ResetPasswordController(this._ref) : super(const SubmissionState.idle());

  Future<void> submit({required String code, required String newPassword}) async {
    state = const SubmissionState.submitting();
    final result = await _ref.read(authRepositoryProvider).confirmPasswordReset(code: code, newPassword: newPassword);
    result.when(
      success: (_) => state = const SubmissionState.success(),
      failure: (f) => state = SubmissionState.error(f),
    );
  }
}

class EmailVerificationController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  EmailVerificationController(this._ref) : super(const SubmissionState.idle());

  Future<void> resend() async {
    state = const SubmissionState.submitting();
    final result = await _ref.read(authRepositoryProvider).resendEmailVerification();
    result.when(
      success: (_) => state = const SubmissionState.success(),
      failure: (f) => state = SubmissionState.error(f),
    );
  }

  /// Returns true once Firebase reports the email verified.
  Future<bool> checkVerified() async {
    final result = await _ref.read(authRepositoryProvider).refreshEmailVerified();
    return result.dataOrNull ?? false;
  }
}

final forgotPasswordControllerProvider =
    StateNotifierProvider.autoDispose<ForgotPasswordController, SubmissionState>((ref) => ForgotPasswordController(ref));

final resetPasswordControllerProvider =
    StateNotifierProvider.autoDispose<ResetPasswordController, SubmissionState>((ref) => ResetPasswordController(ref));

final emailVerificationControllerProvider =
    StateNotifierProvider.autoDispose<EmailVerificationController, SubmissionState>(
        (ref) => EmailVerificationController(ref));
