// lib/features/technician/profile/profile_screen.dart
//
// Technician profile: identity, license + expiry (with an expiry warning), skills,
// availability toggle, and logout. Read-only for licensing (Admin-managed per the API).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_providers.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

class TechnicianProfileScreen extends ConsumerWidget {
  const TechnicianProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(technicianProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: AsyncValueView<TechnicianProfile>(
        value: profile,
        onRetry: () => ref.invalidate(technicianProfileProvider),
        data: (p) {
          final expiringSoon = p.licenseExpiry != null && p.licenseExpiry!.isBefore(DateTime.now().add(const Duration(days: 60)));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              CircleAvatar(radius: 36, child: Text(p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : '?', style: const TextStyle(fontSize: 28))),
              const SizedBox(height: 12),
              Center(child: Text(p.fullName, style: context.text.titleLarge)),
              if (p.email != null) Center(child: Text(p.email!, style: context.text.bodySmall)),
              const SizedBox(height: 20),
              Card(
                child: Column(children: [
                  ListTile(leading: const Icon(Icons.phone_outlined), title: const Text('Phone'), subtitle: Text(p.phone ?? '—')),
                  ListTile(
                    leading: Icon(Icons.badge_outlined, color: expiringSoon ? context.colors.error : null),
                    title: const Text('License'),
                    subtitle: Text([
                      if (p.licenseNumber != null) p.licenseNumber!,
                      if (p.licenseExpiry != null) 'Expires ${DateFormat.yMMMd().format(p.licenseExpiry!)}',
                    ].join(' • ')),
                    trailing: expiringSoon ? Icon(Icons.warning_amber, color: context.colors.error) : null,
                  ),
                ]),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Skills', style: context.text.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: p.skills.isEmpty ? [const Text('—')] : p.skills.map((s) => Chip(label: Text(s))).toList()),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: SwitchListTile(
                  value: p.isAvailable,
                  title: const Text('Available for jobs'),
                  secondary: const Icon(Icons.toggle_on_outlined),
                  onChanged: (v) async {
                    final res = await ref.read(technicianRepositoryProvider).setAvailability(v);
                    res.when(success: (_) => ref.invalidate(technicianProfileProvider), failure: (f) => context.mounted ? context.showSnack(f.message) : null);
                  },
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: Icon(Icons.logout, color: context.colors.error),
                  title: Text('Log out', style: TextStyle(color: context.colors.error)),
                  onTap: () => ref.read(logoutProvider)(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
