// lib/features/auth/presentation/screens/forgot_password_screen.dart
//
// Firebase-delegated reset: sends a reset email. Uses a generic success message
// (enumeration-safe) regardless of whether the email exists.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../application/auth_validators.dart';
import '../../application/password_controllers.dart';
import '../../application/submission_state.dart';
import '../widgets/auth_widgets.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      ref.read(forgotPasswordControllerProvider.notifier).submit(_email.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(forgotPasswordControllerProvider);
    ref.listen(forgotPasswordControllerProvider, (_, next) {
      if (next.isFailure) showAuthError(context, next.failure);
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AuthHeader(
                  title: 'Forgot your password?',
                  subtitle: 'Enter your email and we’ll send a reset link.',
                ),
                const SizedBox(height: 28),
                if (state.isSuccess)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: context.colors.primaryContainer, borderRadius: BorderRadius.circular(12)),
                    child: const Text('If an account exists for that email, a reset link is on its way.'),
                  )
                else ...[
                  AuthTextField(
                    controller: _email,
                    label: 'Email',
                    keyboardType: TextInputType.emailAddress,
                    validator: AuthValidators.email,
                    action: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 24),
                  LoadingButton(label: 'Send reset link', loading: state.isSubmitting, onPressed: _submit),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
