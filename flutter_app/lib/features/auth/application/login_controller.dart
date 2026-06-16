// lib/features/auth/application/login_controller.dart
//
// Drives the login screen: email/password + Google/Apple. On success it commits the
// session to the global AuthController (router redirects to the role home).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/result.dart';
import 'auth_providers.dart';
import 'submission_state.dart';

class LoginController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  LoginController(this._ref) : super(const SubmissionState.idle());

  Future<void> loginEmail({required String email, required String password}) async {
    state = const SubmissionState.submitting();
    final result = await _ref.read(authRepositoryProvider).loginWithEmail(email: email.trim(), password: password);
    await _settle(result);
  }

  Future<void> loginGoogle() async {
    state = const SubmissionState.submitting();
    await _settle(await _ref.read(authRepositoryProvider).loginWithGoogle());
  }

  Future<void> loginApple() async {
    state = const SubmissionState.submitting();
    await _settle(await _ref.read(authRepositoryProvider).loginWithApple());
  }

  Future<void> _settle(Result<dynamic> result) async {
    await result.when(
      success: (session) async {
        await _ref.commitSession(session);
        if (mounted) state = const SubmissionState.success();
      },
      failure: (f) async {
        if (mounted) state = SubmissionState.error(f);
      },
    );
  }
}

final loginControllerProvider =
    StateNotifierProvider.autoDispose<LoginController, SubmissionState>((ref) => LoginController(ref));
