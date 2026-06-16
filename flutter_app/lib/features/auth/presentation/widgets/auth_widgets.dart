// lib/features/auth/presentation/widgets/auth_widgets.dart
//
// Small shared building blocks for auth screens: a labeled text field, a button with a
// loading state, the auth screen header, and social sign-in buttons.

import 'package:flutter/material.dart';
import '../../../../core/extensions/context_extensions.dart';

class AuthTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final bool obscure;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;
  final Widget? suffix;
  final TextInputAction? action;
  final void Function(String)? onSubmitted;

  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.obscure = false,
    this.keyboardType = TextInputType.text,
    this.validator,
    this.suffix,
    this.action,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: context.text.labelLarge),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: action,
          validator: validator,
          onFieldSubmitted: onSubmitted,
          decoration: InputDecoration(hintText: hint, suffixIcon: suffix),
        ),
      ],
    );
  }
}

class LoadingButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onPressed;
  final String label;
  const LoadingButton({super.key, required this.label, this.onPressed, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: loading ? null : onPressed,
      child: loading
          ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
          : Text(label),
    );
  }
}

class AuthHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  const AuthHeader({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: context.text.headlineMedium),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(subtitle!, style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant)),
        ],
      ],
    );
  }
}

class SocialAuthButtons extends StatelessWidget {
  final bool loading;
  final VoidCallback onGoogle;
  final VoidCallback onApple;
  const SocialAuthButtons({super.key, required this.onGoogle, required this.onApple, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        OutlinedButton.icon(
          onPressed: loading ? null : onGoogle,
          icon: const Icon(Icons.g_mobiledata, size: 28),
          label: const Text('Continue with Google'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: loading ? null : onApple,
          icon: const Icon(Icons.apple),
          label: const Text('Continue with Apple'),
        ),
      ],
    );
  }
}

/// Shows the failure message of a submission as a snackbar (called from `ref.listen`).
void showAuthError(BuildContext context, Object? failure) {
  final message = (failure is Object && failure.toString().isNotEmpty)
      ? (failure as dynamic).message as String? ?? 'Something went wrong'
      : 'Something went wrong';
  context.showSnack(message);
}
