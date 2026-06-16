// lib/features/auth/application/profile_setup_controller.dart
//
// Step 2 of registration: provision the backend User/profile from the current Firebase
// session and commit the app JWTs (router then routes to the role home).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/repositories/auth_repository.dart';
import 'auth_providers.dart';
import 'submission_state.dart';

class ProfileSetupController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  ProfileSetupController(this._ref) : super(const SubmissionState.idle());

  Future<void> submit({required String fullName, required String phone, required CustomerType customerType}) async {
    state = const SubmissionState.submitting();
    final result = await _ref.read(authRepositoryProvider).completeRegistration(
          fullName: fullName.trim(),
          phone: phone.trim(),
          customerType: customerType,
        );
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

final profileSetupControllerProvider =
    StateNotifierProvider.autoDispose<ProfileSetupController, SubmissionState>((ref) => ProfileSetupController(ref));
