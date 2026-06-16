// lib/features/shared/settings/presentation/settings_screen.dart
//
// Aggregated settings used by both apps: appearance (dark mode), notification preferences,
// privacy (location sharing while on a job), payment methods + history, and account/logout.
// Theme + notification prefs persist; privacy persists locally.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../providers/theme_provider.dart';
import '../../../auth/application/auth_providers.dart';
import '../../notifications/application/notification_preferences.dart';

final _locationSharingProvider = StateNotifierProvider<_LocationSharingController, bool>((ref) => _LocationSharingController());

class _LocationSharingController extends StateNotifier<bool> {
  static const _key = 'privacy_location_sharing';
  _LocationSharingController() : super(true) {
    _load();
  }
  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    state = p.getBool(_key) ?? true;
  }

  Future<void> set(bool v) async {
    state = v;
    final p = await SharedPreferences.getInstance();
    await p.setBool(_key, v);
  }
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final prefs = ref.watch(notificationPrefsProvider);
    final locationSharing = ref.watch(_locationSharingProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          _section(context, 'Appearance'),
          RadioListTile(value: ThemeMode.system, groupValue: themeMode, title: const Text('System default'), onChanged: (v) => ref.read(themeModeProvider.notifier).set(v!)),
          RadioListTile(value: ThemeMode.light, groupValue: themeMode, title: const Text('Light'), onChanged: (v) => ref.read(themeModeProvider.notifier).set(v!)),
          RadioListTile(value: ThemeMode.dark, groupValue: themeMode, title: const Text('Dark'), onChanged: (v) => ref.read(themeModeProvider.notifier).set(v!)),

          _section(context, 'Notifications'),
          SwitchListTile(value: prefs.push, title: const Text('Push notifications'), onChanged: (v) => ref.read(notificationPrefsProvider.notifier).update(push: v)),
          SwitchListTile(value: prefs.email, title: const Text('Email'), onChanged: (v) => ref.read(notificationPrefsProvider.notifier).update(email: v)),
          SwitchListTile(value: prefs.sms, title: const Text('SMS'), onChanged: (v) => ref.read(notificationPrefsProvider.notifier).update(sms: v)),

          _section(context, 'Privacy'),
          SwitchListTile(
            value: locationSharing,
            title: const Text('Share location during jobs'),
            subtitle: const Text('Lets customers see live ETA while you’re en route'),
            onChanged: (v) => ref.read(_locationSharingProvider.notifier).set(v),
          ),

          _section(context, 'Payments'),
          ListTile(leading: const Icon(Icons.credit_card_outlined), title: const Text('Payment methods'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/payments/methods')),
          ListTile(leading: const Icon(Icons.receipt_long_outlined), title: const Text('Payment history'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/payments/history')),

          _section(context, 'Account'),
          ListTile(
            leading: Icon(Icons.logout, color: context.colors.error),
            title: Text('Log out', style: TextStyle(color: context.colors.error)),
            onTap: () => ref.read(logoutProvider)(),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
        child: Text(title, style: context.text.labelLarge?.copyWith(color: context.colors.primary)),
      );
}
