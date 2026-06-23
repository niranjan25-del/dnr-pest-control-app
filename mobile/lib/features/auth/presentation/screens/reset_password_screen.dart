// lib/features/auth/presentation/screens/reset_password_screen.dart
//
// Completes a reset from the emailed deep link. The `oobCode` is parsed from the link
// (e.g. /reset-password?oobCode=...) and passed in. Calls Firebase confirmPasswordReset.
// NOTE: if you use Firebase-hosted reset pages instead of an app deep link, this screen
// is optional — the Forgot Password flow alone is sufficient.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../application/auth_validators.dart';
import '../../application/password_controllers.dart';
import '../../application/submission_state.dart';
import '../auth_routes.dart';
import '../widgets/auth_widgets.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  final String? oobCode;
  const ResetPasswordScreen({super.key, this.oobCode});
  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _submit() {
    if (widget.oobCode == null) {
      showAuthError(context, 'Invalid or expired reset link.');
      return;
    }
    if (_formKey.currentState?.validate() ?? false) {
      ref.read(resetPasswordControllerProvider.notifier).submit(code: widget.oobCode!, newPassword: _password.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resetPasswordControllerProvider);
    ref.listen(resetPasswordControllerProvider, (_, next) {
      if (next.isFailure) showAuthError(context, next.failure);
      if (next.isSuccess) {
        context.go(AuthRoutes.signIn);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Set a new password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AuthTextField(
                  controller: _password,
                  label: 'New password',
                  obscure: _obscure,
                  validator: AuthValidators.password,
                  suffix: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                const SizedBox(height: 16),
                AuthTextField(
                  controller: _confirm,
                  label: 'Confirm new password',
                  obscure: _obscure,
                  validator: (v) => AuthValidators.confirmPassword(v, _password.text),
                  action: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 24),
                LoadingButton(label: 'Update password', loading: state.isSubmitting, onPressed: _submit),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
