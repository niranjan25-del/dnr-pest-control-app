// lib/features/customer/bookings/booking_screens.dart
//
// Booking history (tabbed upcoming/past), booking details (with reschedule + cancel
// actions and a "leave a review" entry for completed bookings), and the reschedule
// screen. Grouped because they share models/providers.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/state/submission_state.dart';
import '../../../shared/utils/money.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

// ---------- History ----------
class BookingHistoryScreen extends ConsumerWidget {
  const BookingHistoryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My bookings'),
          bottom: const TabBar(tabs: [Tab(text: 'Upcoming'), Tab(text: 'Past')]),
        ),
        body: TabBarView(children: [_BookingList(upcoming: true), _BookingList(upcoming: false)]),
      ),
    );
  }
}

class _BookingList extends ConsumerWidget {
  final bool upcoming;
  const _BookingList({required this.upcoming});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(bookingsProvider(null));
    return AsyncValueView<Paginated<Booking>>(
      value: bookings,
      onRetry: () => ref.invalidate(bookingsProvider),
      data: (page) {
        final items = page.data.where((b) => b.isUpcoming == upcoming).toList();
        if (items.isEmpty) {
          return EmptyView(icon: upcoming ? Icons.event_available_outlined : Icons.history, title: upcoming ? 'No upcoming bookings' : 'No past bookings');
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(bookingsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final b = items[i];
              return Card(
                child: ListTile(
                  title: Text(b.serviceName ?? 'Service'),
                  subtitle: Text([if (b.windowStart != null) '${b.windowStart}'.split('.').first, b.status].join('  •  ')),
                  trailing: Text(Money.format(b.price, currency: b.currency)),
                  onTap: () => context.go('/customer/bookings/${b.id}'),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ---------- Details ----------
class BookingDetailsScreen extends ConsumerWidget {
  final String bookingId;
  const BookingDetailsScreen({super.key, required this.bookingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(bookingDetailProvider(bookingId));
    return Scaffold(
      appBar: AppBar(title: const Text('Booking details')),
      body: AsyncValueView<Booking>(
        value: detail,
        onRetry: () => ref.invalidate(bookingDetailProvider(bookingId)),
        data: (b) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _statusChip(context, b.status),
            const SizedBox(height: 16),
            _row(context, 'Service', b.serviceName ?? '—'),
            _row(context, 'When', b.windowStart == null ? '—' : '${b.windowStart}'.split('.').first),
            _row(context, 'Address', b.addressLine ?? '—'),
            if (b.technicianName != null) _row(context, 'Technician', b.technicianName!),
            _row(context, 'Total', Money.format(b.price, currency: b.currency)),
            const SizedBox(height: 24),
            if (b.isCompleted)
              FilledButton.icon(
                onPressed: () => context.push('/customer/bookings/${b.id}/review'),
                icon: const Icon(Icons.star_outline),
                label: const Text('Leave a review'),
              ),
            if (b.isUpcoming) ...[
              OutlinedButton.icon(
                onPressed: () => context.push('/customer/bookings/${b.id}/reschedule'),
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Reschedule'),
              ),
              const SizedBox(height: 8),
              if (b.isCancellable)
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(foregroundColor: context.colors.error),
                  onPressed: () => _confirmCancel(context, ref, b),
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Cancel booking'),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref, Booking b) async {
    final reasonController = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('A cancellation fee may apply per policy.'),
          const SizedBox(height: 12),
          TextField(controller: reasonController, decoration: const InputDecoration(hintText: 'Reason (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Cancel booking')),
        ],
      ),
    );
    if (ok != true) return;
    final res = await ref.read(bookingRepositoryProvider).cancel(id: b.id, reason: reasonController.text);
    if (!context.mounted) return;
    res.when(
      success: (_) {
        ref.invalidate(bookingDetailProvider(b.id));
        ref.invalidate(bookingsProvider);
        context.showSnack('Booking cancelled');
      },
      failure: (f) => context.showSnack(f.message),
    );
  }

  Widget _statusChip(BuildContext context, String status) =>
      Align(alignment: Alignment.centerLeft, child: Chip(label: Text(status), backgroundColor: context.colors.secondaryContainer));

  Widget _row(BuildContext context, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: Text(k, style: context.text.labelMedium)),
          Expanded(child: Text(v, style: context.text.bodyMedium)),
        ]),
      );
}

// ---------- Reschedule ----------
class RescheduleScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const RescheduleScreen({super.key, required this.bookingId});
  @override
  ConsumerState<RescheduleScreen> createState() => _RescheduleScreenState();
}

class _RescheduleScreenState extends ConsumerState<RescheduleScreen> {
  DateTime? _start;
  SubmissionState _state = const SubmissionState.idle();

  Future<void> _pick() async {
    final now = DateTime.now();
    final date = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 90)), initialDate: now.add(const Duration(days: 1)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
    if (time == null) return;
    setState(() => _start = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _submit() async {
    if (_start == null) return;
    setState(() => _state = const SubmissionState.submitting());
    final res = await ref.read(bookingRepositoryProvider).reschedule(
          id: widget.bookingId,
          windowStart: _start!,
          windowEnd: _start!.add(const Duration(hours: 3)),
        );
    if (!mounted) return;
    res.when(
      success: (_) {
        ref.invalidate(bookingDetailProvider(widget.bookingId));
        ref.invalidate(bookingsProvider);
        context.showSnack('Booking rescheduled');
        context.pop();
      },
      failure: (f) {
        setState(() => _state = SubmissionState.error(f));
        context.showSnack(f.message);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reschedule')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.event),
                title: Text(_start == null ? 'Pick a new date & time' : '${_start!}'.split('.').first),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pick,
              ),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _start == null || _state.isSubmitting ? null : _submit,
              child: _state.isSubmitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : const Text('Confirm reschedule'),
            ),
          ],
        ),
      ),
    );
  }
}
