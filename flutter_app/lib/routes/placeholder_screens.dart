// lib/routes/placeholder_screens.dart
//
// Minimal placeholders so the router compiles and runs end-to-end in the foundation.
// FEATURE MODULES REPLACE THESE — do not build real UI here.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_controller.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class SignInPlaceholder extends StatelessWidget {
  const SignInPlaceholder({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Sign in')),
        body: const Center(child: Text('Auth feature module renders here.')),
      );
}

class RoleHomePlaceholder extends ConsumerWidget {
  final String label;
  const RoleHomePlaceholder(this.label, {super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        appBar: AppBar(
          title: Text(label),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            ),
          ],
        ),
        body: Center(child: Text('$label shell — feature modules render here.')),
      );
}
