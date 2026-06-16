// lib/features/auth/application/register_controller.dart
//
// Two-step registration. Step 1 creates the Firebase user (+ verification email) and, on
// success, the screen navigates to Profile Setup. Step 2 (ProfileSetupController) calls
// the backend to provision the User and commit the session.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_providers.dart';
import 'submission_state.dart';

class RegisterController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  RegisterController(this._ref) : super(const SubmissionState.idle());

  Future<void> createAccount({required String email, required String password, required String fullName}) async {
    state = const SubmissionState.submitting();
    final result = await _ref
        .read(authRepositoryProvider)
        .registerFirebaseUser(email: email.trim(), password: password, fullName: fullName.trim());
    result.when(
      success: (_) => state = const SubmissionState.success(),
      failure: (f) => state = SubmissionState.error(f),
    );
  }
}

final registerControllerProvider =
    StateNotifierProvider.autoDispose<RegisterController, SubmissionState>((ref) => RegisterController(ref));
