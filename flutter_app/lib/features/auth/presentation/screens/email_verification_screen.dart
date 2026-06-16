// lib/features/auth/presentation/screens/email_verification_screen.dart
//
// After Firebase sign-up: prompt the user to verify, allow resend, and poll Firebase for
// verified status. Once verified, continue to Profile Setup (backend provisioning). Per
// the auth design, verification is encouraged; gating policy can tighten this later.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../application/password_controllers.dart';
import '../../application/submission_state.dart';
import '../auth_routes.dart';
import '../widgets/auth_widgets.dart';

class EmailVerificationScreen extends ConsumerStatefulWidget {
  const EmailVerificationScreen({super.key});
  @override
  ConsumerState<EmailVerificationScreen> createState() => _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends ConsumerState<EmailVerificationScreen> {
  Timer? _poll;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    // Light polling so the screen advances automatically once verified.
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _check(auto: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _check({bool auto = false}) async {
    if (_checking) return;
    setState(() => _checking = true);
    final verified = await ref.read(emailVerificationControllerProvider.notifier).checkVerified();
    if (!mounted) return;
    setState(() => _checking = false);
    if (verified) {
      _poll?.cancel();
      context.go(AuthRoutes.profileSetup);
    } else if (!auto) {
      context.showSnack('Not verified yet — check your inbox.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(emailVerificationControllerProvider);
    ref.listen(emailVerificationControllerProvider, (_, next) {
      if (next.isFailure) showAuthError(context, next.failure);
      if (next.isSuccess) context.showSnack('Verification email sent.');
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Verify your email')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              Icon(Icons.mark_email_unread_outlined, size: 88, color: context.colors.primary),
              const SizedBox(height: 24),
              Text('Check your inbox', style: context.text.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(
                'We sent you a verification link. Verify your email to continue setting up your account.',
                style: context.text.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              LoadingButton(label: "I've verified — continue", loading: _checking, onPressed: () => _check()),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: state.isSubmitting
                    ? null
                    : () => ref.read(emailVerificationControllerProvider.notifier).resend(),
                child: const Text('Resend email'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
