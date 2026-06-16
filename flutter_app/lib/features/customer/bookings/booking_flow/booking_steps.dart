// lib/features/customer/bookings/booking_flow/booking_steps.dart
//
// The 10 booking steps as composable widgets, each reading/writing the shared
// BookingDraft. Kept in one file because they share the same controller and styling; the
// wizard screen pages through them. Each step exposes `canAdvance` via the draft.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../shared/utils/money.dart';
import '../../../../shared/widgets/state_views.dart';
import '../../shared/application/customer_providers.dart';
import '../../shared/models/customer_models.dart';
import 'booking_draft_controller.dart';

// 1 — Select Service
class SelectServiceStep extends ConsumerWidget {
  const SelectServiceStep({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final services = ref.watch(servicesProvider);
    final selected = ref.watch(bookingDraftControllerProvider).draft.service;
    return AsyncValueView<List<Service>>(
      value: services,
      onRetry: () => ref.invalidate(servicesProvider),
      isEmpty: (d) => d.isEmpty,
      empty: const EmptyView(icon: Icons.pest_control, title: 'No services available'),
      data: (list) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final s = list[i];
          final isSel = selected?.id == s.id;
          return Card(
            color: isSel ? context.colors.primaryContainer : null,
            child: ListTile(
              title: Text(s.name),
              subtitle: Text([if (s.category != null) s.category!, '${Money.format(s.basePrice)} • ${s.estimatedDurationMin ?? 60} min'].join('  •  ')),
              trailing: isSel ? const Icon(Icons.check_circle) : null,
              onTap: () => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(service: s, pestType: null)),
            ),
          );
        },
      ),
    );
  }
}

// 2 — Select Pest Type (from the chosen service's target pests)
class SelectPestStep extends ConsumerWidget {
  const SelectPestStep({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftControllerProvider).draft;
    final pests = draft.service?.targetPests ?? const [];
    if (pests.isEmpty) {
      return const EmptyView(icon: Icons.bug_report_outlined, title: 'No specific pest selection', subtitle: 'This service covers general treatment. Continue.');
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: pests
            .map((p) => ChoiceChip(
                  label: Text(p),
                  selected: draft.pestType == p,
                  onSelected: (_) => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(pestType: p)),
                ))
            .toList(),
      ),
    );
  }
}

// 3 — Select Package (one-time vs recurring; MVP routes one-time via service)
class SelectPackageStep extends ConsumerWidget {
  const SelectPackageStep({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(bookingDraftControllerProvider).draft.mode;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          RadioListTile<BookingMode>(
            value: BookingMode.oneTime,
            groupValue: mode,
            title: const Text('One-time service'),
            subtitle: const Text('A single visit for this treatment.'),
            onChanged: (v) => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(mode: v)),
          ),
          RadioListTile<BookingMode>(
            value: BookingMode.recurring,
            groupValue: mode,
            title: const Text('Recurring plan'),
            subtitle: const Text('Scheduled repeat visits (set up as a subscription).'),
            onChanged: (v) => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(mode: v)),
          ),
          if (mode == BookingMode.recurring)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text('Recurring plans are set up in Subscriptions; this booking will proceed as a one-time visit for now.',
                  style: context.text.bodySmall),
            ),
        ],
      ),
    );
  }
}

// 4 — Select Address
class SelectAddressStep extends ConsumerWidget {
  final VoidCallback onAddAddress;
  const SelectAddressStep({super.key, required this.onAddAddress});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider);
    final selected = ref.watch(bookingDraftControllerProvider).draft.address;
    return AsyncValueView<List<Address>>(
      value: addresses,
      onRetry: () => ref.invalidate(addressesProvider),
      isEmpty: (d) => d.isEmpty,
      empty: EmptyView(
        icon: Icons.home_outlined,
        title: 'No saved addresses',
        subtitle: 'Add a service address to continue.',
        action: FilledButton(onPressed: onAddAddress, child: const Text('Add address')),
      ),
      data: (list) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ...list.map((a) => Card(
                color: selected?.id == a.id ? context.colors.primaryContainer : null,
                child: ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: Text(a.label),
                  subtitle: Text(a.oneLine),
                  trailing: selected?.id == a.id ? const Icon(Icons.check_circle) : null,
                  onTap: () => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(address: a)),
                ),
              )),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: onAddAddress, icon: const Icon(Icons.add), label: const Text('Add new address')),
        ],
      ),
    );
  }
}

// 5 — Select Date & Time (a window start/end)
class SelectScheduleStep extends ConsumerWidget {
  const SelectScheduleStep({super.key});

  Future<void> _pick(BuildContext context, WidgetRef ref) async {
    final now = DateTime.now();
    final date = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 90)), initialDate: now.add(const Duration(days: 1)));
    if (date == null) return;
    if (!context.mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
    if (time == null) return;
    final start = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(windowStart: start, windowEnd: start.add(const Duration(hours: 3))));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftControllerProvider).draft;
    final start = draft.windowStart;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Choose a 3-hour arrival window.', style: context.text.bodyMedium),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.event),
              title: Text(start == null ? 'Select date & time' : '${start.toLocal()}'.split('.').first),
              subtitle: start == null ? null : Text('Window: ${TimeOfDay.fromDateTime(start).format(context)} – ${TimeOfDay.fromDateTime(draft.windowEnd!).format(context)}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _pick(context, ref),
            ),
          ),
        ],
      ),
    );
  }
}

// 6 — Upload Photos
class UploadPhotosStep extends ConsumerWidget {
  const UploadPhotosStep({super.key});

  Future<void> _add(WidgetRef ref) async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 70);
    if (picked.isEmpty) return;
    ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(photos: [...d.photos, ...picked.map((x) => File(x.path))]));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(bookingDraftControllerProvider).draft.photos;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Add photos of the problem area (optional).', style: context.text.bodyMedium),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ...photos.map((f) => ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(f, width: 88, height: 88, fit: BoxFit.cover))),
              InkWell(
                onTap: () => _add(ref),
                child: Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(border: Border.all(color: context.colors.outline), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.add_a_photo_outlined),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// 7 — Add Notes
class AddNotesStep extends ConsumerStatefulWidget {
  const AddNotesStep({super.key});
  @override
  ConsumerState<AddNotesStep> createState() => _AddNotesStepState();
}

class _AddNotesStepState extends ConsumerState<AddNotesStep> {
  late final TextEditingController _c =
      TextEditingController(text: ref.read(bookingDraftControllerProvider).draft.notes);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: _c,
        maxLines: 6,
        decoration: const InputDecoration(hintText: 'Anything the technician should know? (gate code, pets, severity…)'),
        onChanged: (v) => ref.read(bookingDraftControllerProvider.notifier).update((d) => d.copyWith(notes: v)),
      ),
    );
  }
}

// 8 — Review Booking
class ReviewStep extends ConsumerWidget {
  const ReviewStep({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(bookingDraftControllerProvider).draft;
    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 110, child: Text(k, style: context.text.labelMedium)),
            Expanded(child: Text(v, style: context.text.bodyMedium)),
          ]),
        );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Review your booking', style: context.text.titleLarge),
        const SizedBox(height: 12),
        row('Service', d.service?.name ?? '—'),
        if (d.pestType != null) row('Pest', d.pestType!),
        row('Address', d.address?.oneLine ?? '—'),
        row('When', d.windowStart == null ? '—' : '${d.windowStart}'.split('.').first),
        row('Photos', '${d.photos.length} attached'),
        if ((d.notes ?? '').isNotEmpty) row('Notes', d.notes!),
        const Divider(height: 32),
        row('Estimated', Money.format(d.service?.basePrice)),
        const SizedBox(height: 8),
        Text('Final price (incl. any discount) is confirmed on the next step.', style: context.text.bodySmall),
      ],
    );
  }
}
