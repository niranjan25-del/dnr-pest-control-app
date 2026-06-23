// lib/features/customer/addresses/address_screens.dart
//
// Address list (set-default, delete) + add/edit form. Uses the AccountRepository directly
// for mutations and invalidates the addresses provider so lists refresh.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/state/submission_state.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_validators.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

class AddressListScreen extends ConsumerWidget {
  const AddressListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My addresses')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/customer/addresses/new'),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: AsyncValueView<List<Address>>(
        value: addresses,
        onRetry: () => ref.invalidate(addressesProvider),
        isEmpty: (d) => d.isEmpty,
        empty: const EmptyView(icon: Icons.home_outlined, title: 'No addresses yet', subtitle: 'Add your first service address.'),
        data: (list) => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final a = list[i];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.location_on_outlined),
                title: Row(children: [
                  Text(a.label),
                  if (a.isDefault) ...[const SizedBox(width: 8), Chip(label: const Text('Default'), visualDensity: VisualDensity.compact)],
                ]),
                subtitle: Text(a.oneLine),
                trailing: PopupMenuButton<String>(
                  onSelected: (v) => _action(context, ref, a, v),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (!a.isDefault) const PopupMenuItem(value: 'default', child: Text('Set as default')),
                    const PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
                onTap: () => context.push('/customer/addresses/${a.id}/edit', extra: a),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _action(BuildContext context, WidgetRef ref, Address a, String v) async {
    final repo = ref.read(accountRepositoryProvider);
    switch (v) {
      case 'edit':
        context.push('/customer/addresses/${a.id}/edit', extra: a);
      case 'default':
        (await repo.setDefaultAddress(a.id)).when(
          success: (_) => ref.invalidate(addressesProvider),
          failure: (f) => context.mounted ? context.showSnack(f.message) : null,
        );
      case 'delete':
        final res = await repo.deleteAddress(a.id);
        if (!context.mounted) return;
        res.when(success: (_) => ref.invalidate(addressesProvider), failure: (f) => context.showSnack(f.message));
    }
  }
}

class AddressFormScreen extends ConsumerStatefulWidget {
  final Address? existing;
  const AddressFormScreen({super.key, this.existing});
  @override
  ConsumerState<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends ConsumerState<AddressFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _label = TextEditingController(text: widget.existing?.label);
  late final _line1 = TextEditingController(text: widget.existing?.line1);
  late final _line2 = TextEditingController(text: widget.existing?.line2);
  late final _city = TextEditingController(text: widget.existing?.city);
  late final _state = TextEditingController(text: widget.existing?.state);
  late final _postal = TextEditingController(text: widget.existing?.postalCode);
  late final _gate = TextEditingController(text: widget.existing?.gateCode);
  late final _notes = TextEditingController(text: widget.existing?.accessNotes);
  SubmissionState _submit = const SubmissionState.idle();

  @override
  void dispose() {
    for (final c in [_label, _line1, _line2, _city, _state, _postal, _gate, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submit = const SubmissionState.submitting());
    final body = {
      'label': _label.text.trim(),
      'line1': _line1.text.trim(),
      if (_line2.text.trim().isNotEmpty) 'line2': _line2.text.trim(),
      'city': _city.text.trim(),
      'state': _state.text.trim(),
      'postal_code': _postal.text.trim(),
      'country': widget.existing?.country ?? 'IN',
      if (_gate.text.trim().isNotEmpty) 'gate_code': _gate.text.trim(),
      if (_notes.text.trim().isNotEmpty) 'access_notes': _notes.text.trim(),
    };
    final res = await ref.read(accountRepositoryProvider).upsertAddress(body, id: widget.existing?.id);
    if (!mounted) return;
    res.when(
      success: (_) {
        ref.invalidate(addressesProvider);
        context.pop();
      },
      failure: (f) {
        setState(() => _submit = SubmissionState.error(f));
        context.showSnack(f.message);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget field(String label, TextEditingController c, {String? Function(String?)? v, TextInputType? kb}) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextFormField(controller: c, keyboardType: kb, validator: v, decoration: InputDecoration(labelText: label)),
        );
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Add address' : 'Edit address')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              field('Label (Home, Office…)', _label, v: (x) => AuthValidators.required(x, 'Label')),
              field('Address line 1', _line1, v: (x) => AuthValidators.required(x, 'Address')),
              field('Address line 2 (optional)', _line2),
              field('City', _city, v: (x) => AuthValidators.required(x, 'City')),
              field('State', _state, v: (x) => AuthValidators.required(x, 'State')),
              field('Postal code', _postal, kb: TextInputType.number, v: (x) => AuthValidators.required(x, 'Postal code')),
              field('Gate code (optional)', _gate),
              field('Access notes (optional)', _notes),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _submit.isSubmitting ? null : _save,
                child: _submit.isSubmitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Save address'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
