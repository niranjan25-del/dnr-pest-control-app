// lib/features/auth/presentation/screens/register_screen.dart
//
// Step 1 of sign-up: name/email/password → creates the Firebase user + sends a
// verification email, then routes to Email Verification (which leads to Profile Setup).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../application/auth_validators.dart';
import '../../application/register_controller.dart';
import '../../application/submission_state.dart';
import '../auth_routes.dart';
import '../widgets/auth_widgets.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      ref
          .read(registerControllerProvider.notifier)
          .createAccount(email: _email.text, password: _password.text, fullName: _name.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(registerControllerProvider);
    ref.listen(registerControllerProvider, (_, next) {
      if (next.isFailure) showAuthError(context, next.failure);
      if (next.isSuccess) context.go(AuthRoutes.emailVerification);
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AuthTextField(controller: _name, label: 'Full name', validator: AuthValidators.fullName, action: TextInputAction.next),
                const SizedBox(height: 16),
                AuthTextField(
                  controller: _email,
                  label: 'Email',
                  keyboardType: TextInputType.emailAddress,
                  validator: AuthValidators.email,
                  action: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                AuthTextField(
                  controller: _password,
                  label: 'Password',
                  obscure: _obscure,
                  validator: AuthValidators.password,
                  action: TextInputAction.next,
                  suffix: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                const SizedBox(height: 16),
                AuthTextField(
                  controller: _confirm,
                  label: 'Confirm password',
                  obscure: _obscure,
                  validator: (v) => AuthValidators.confirmPassword(v, _password.text),
                  action: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 24),
                LoadingButton(label: 'Create account', loading: state.isSubmitting, onPressed: _submit),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
