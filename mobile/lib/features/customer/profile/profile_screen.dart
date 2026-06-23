// lib/features/customer/profile/profile_screen.dart
//
// Profile view with inline edit (name/phone/company) + entries to addresses and logout.
// Reads profileProvider; edit posts to the AccountRepository and invalidates.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/state/submission_state.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_providers.dart';
import '../../auth/application/auth_validators.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: AsyncValueView<CustomerProfile>(
        value: profile,
        onRetry: () => ref.invalidate(profileProvider),
        data: (p) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            CircleAvatar(radius: 36, child: Text(p.fullName.isNotEmpty ? p.fullName[0].toUpperCase() : '?', style: const TextStyle(fontSize: 28))),
            const SizedBox(height: 12),
            Center(child: Text(p.fullName, style: context.text.titleLarge)),
            if (p.email != null) Center(child: Text(p.email!, style: context.text.bodySmall)),
            const SizedBox(height: 24),
            Card(
              child: Column(children: [
                ListTile(leading: const Icon(Icons.phone_outlined), title: const Text('Phone'), subtitle: Text(p.phone ?? '—')),
                if (p.companyName != null) ListTile(leading: const Icon(Icons.business_outlined), title: const Text('Company'), subtitle: Text(p.companyName!)),
                ListTile(leading: const Icon(Icons.badge_outlined), title: const Text('Account type'), subtitle: Text(p.customerType ?? 'Residential')),
              ]),
            ),
            const SizedBox(height: 8),
            Card(
              child: Column(children: [
                ListTile(
                  leading: const Icon(Icons.edit_outlined),
                  title: const Text('Edit profile'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _editSheet(context, ref, p),
                ),
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: const Text('My addresses'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/customer/addresses'),
                ),
              ]),
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
        ),
      ),
    );
  }

  void _editSheet(BuildContext context, WidgetRef ref, CustomerProfile p) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _EditProfileForm(profile: p),
      ),
    );
  }
}

class _EditProfileForm extends ConsumerStatefulWidget {
  final CustomerProfile profile;
  const _EditProfileForm({required this.profile});
  @override
  ConsumerState<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends ConsumerState<_EditProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.profile.fullName);
  late final _phone = TextEditingController(text: widget.profile.phone);
  late final _company = TextEditingController(text: widget.profile.companyName);
  SubmissionState _state = const SubmissionState.idle();

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _company.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _state = const SubmissionState.submitting());
    final res = await ref.read(accountRepositoryProvider).updateProfile(
          fullName: _name.text.trim(),
          phone: _phone.text.trim(),
          companyName: _company.text.trim().isEmpty ? null : _company.text.trim(),
        );
    if (!mounted) return;
    res.when(
      success: (_) {
        ref.invalidate(profileProvider);
        Navigator.pop(context);
      },
      failure: (f) {
        setState(() => _state = SubmissionState.error(f));
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Edit profile', style: context.text.titleLarge),
          const SizedBox(height: 16),
          TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Full name'), validator: AuthValidators.fullName),
          const SizedBox(height: 12),
          TextFormField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone'), validator: AuthValidators.phone),
          const SizedBox(height: 12),
          TextFormField(controller: _company, decoration: const InputDecoration(labelText: 'Company (optional)')),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _state.isSubmitting ? null : _save,
            child: _state.isSubmitting
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                : const Text('Save'),
          ),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }
}
