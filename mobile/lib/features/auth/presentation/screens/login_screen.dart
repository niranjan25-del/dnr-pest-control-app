// lib/features/auth/presentation/screens/login_screen.dart
//
// Email/password + social login. On success the controller commits the session and the
// router redirects to the role home — so there's no manual navigation on success here.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../providers/auth_controller.dart';
import '../../application/auth_validators.dart';
import '../../application/login_controller.dart';
import '../../application/submission_state.dart';
import '../auth_routes.dart';
import '../widgets/auth_widgets.dart';
import '../../../routes/app_routes.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      ref.read(loginControllerProvider.notifier).loginEmail(email: _email.text, password: _password.text);
    }
  }

  String? _homeForRole(AppRole role) {
    switch (role) {
      case AppRole.customer:
        return AppRoutes.customerHome;
      case AppRole.technician:
        return AppRoutes.technicianHome;
      case AppRole.admin:
        return AppRoutes.adminHome;
      case AppRole.unknown:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginControllerProvider);
    ref.listen(loginControllerProvider, (_, next) {
      if (next.isFailure) {
        showAuthError(context, next.failure);
      } else if (next.isSuccess) {
        final role = ref.read(authControllerProvider).role;
        final home = _homeForRole(role);
        if (home != null && GoRouter.of(context).location != home) {
          context.go(home);
        }
      }
    });
    final loading = state.isSubmitting;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                const AuthHeader(title: 'Welcome back', subtitle: 'Sign in to your DNR Pest Control account.'),
                const SizedBox(height: 32),
                AuthTextField(
                  controller: _email,
                  label: 'Email',
                  hint: 'you@example.com',
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
                  action: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  suffix: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.push(AuthRoutes.forgotPassword),
                    child: const Text('Forgot password?'),
                  ),
                ),
                const SizedBox(height: 8),
                LoadingButton(label: 'Sign in', loading: loading, onPressed: _submit),
                const SizedBox(height: 20),
                Row(children: [
                  const Expanded(child: Divider()),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: context.text.bodySmall)),
                  const Expanded(child: Divider()),
                ]),
                const SizedBox(height: 20),
                SocialAuthButtons(
                  loading: loading,
                  onGoogle: () => ref.read(loginControllerProvider.notifier).loginGoogle(),
                  onApple: () => ref.read(loginControllerProvider.notifier).loginApple(),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Don't have an account?"),
                    TextButton(onPressed: () => context.push(AuthRoutes.register), child: const Text('Sign up')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
