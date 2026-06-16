// lib/app/admin_notice_screen.dart
//
// Admin has only limited mobile presence by design — full administration is the React web
// app. If an admin signs in on mobile, they land here. (No Admin feature module exists; this
// is an integration-level landing, not an Admin dashboard.)

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/extensions/context_extensions.dart';
import '../features/auth/application/auth_providers.dart';

class AdminMobileNoticeScreen extends ConsumerWidget {
  const AdminMobileNoticeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('DNR Admin')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.desktop_windows_outlined, size: 72, color: context.colors.primary),
              const SizedBox(height: 16),
              Text('Admin runs on the web', style: context.text.titleLarge, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text('Please use the DNR Pest Control web admin for full management tools.', style: context.text.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              OutlinedButton(onPressed: () => ref.read(logoutProvider)(), child: const Text('Log out')),
            ],
          ),
        ),
      ),
    );
  }
}
