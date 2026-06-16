// lib/features/customer/bookings/booking_flow/booking_flow_screen.dart
//
// The booking wizard. Pages through steps 1–8, then step 9 (create booking + pay) and
// step 10 (confirmation). A bottom bar drives Back/Next with per-step validation; Next is
// disabled until the current step's data is present.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../shared/state/submission_state.dart';
import '../../../../shared/utils/money.dart';
import '../../payments/payment_controller.dart';
import '../../shared/application/customer_providers.dart';
import 'booking_draft_controller.dart';
import 'booking_steps.dart';

class BookingFlowScreen extends ConsumerStatefulWidget {
  const BookingFlowScreen({super.key});
  @override
  ConsumerState<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends ConsumerState<BookingFlowScreen> {
  int _step = 0;
  static const _titles = [
    'Select service', 'Pest type', 'Plan', 'Address', 'Date & time',
    'Photos', 'Notes', 'Review', 'Payment', 'Confirmed',
  ];

  bool _canAdvance(BookingDraft d) {
    switch (_step) {
      case 0:
        return d.hasService;
      case 3:
        return d.hasAddress;
      case 4:
        return d.hasSchedule;
      default:
        return true; // pest/plan/photos/notes/review optional or always-ok
    }
  }

  Future<void> _next() async {
    final notifier = ref.read(bookingDraftControllerProvider.notifier);
    if (_step == 7) {
      // Review → create the booking, then move to payment.
      final booking = await notifier.submitBooking();
      if (booking == null) return; // error surfaced via listener
      setState(() => _step = 8);
      return;
    }
    if (_step < 9) setState(() => _step++);
  }

  void _back() {
    if (_step == 0) {
      context.pop();
    } else if (_step <= 8) {
      setState(() => _step--);
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(bookingDraftControllerProvider);
    ref.listen(bookingDraftControllerProvider, (_, next) {
      if (next.submission.isFailure) context.showSnack(next.submission.failure?.message ?? 'Could not create booking');
    });

    final body = switch (_step) {
      0 => const SelectServiceStep(),
      1 => const SelectPestStep(),
      2 => const SelectPackageStep(),
      3 => SelectAddressStep(onAddAddress: () => context.push('/customer/addresses/new')),
      4 => const SelectScheduleStep(),
      5 => const UploadPhotosStep(),
      6 => const AddNotesStep(),
      7 => const ReviewStep(),
      8 => _PaymentStep(onPaid: () => setState(() => _step = 9)),
      _ => const _ConfirmationStep(),
    };

    return PopScope(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _step > 0 && _step < 9) _back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_titles[_step]),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(4),
            child: LinearProgressIndicator(value: (_step + 1) / _titles.length),
          ),
        ),
        body: SafeArea(child: body),
        bottomNavigationBar: _step >= 8
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      if (_step > 0)
                        Expanded(child: OutlinedButton(onPressed: _back, child: const Text('Back'))),
                      if (_step > 0) const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _canAdvance(flow.draft) && !flow.submission.isSubmitting ? _next : null,
                          child: flow.submission.isSubmitting
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                              : Text(_step == 7 ? 'Confirm & continue' : 'Next'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}

// 9 — Payment
class _PaymentStep extends ConsumerWidget {
  final VoidCallback onPaid;
  const _PaymentStep({required this.onPaid});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flow = ref.watch(bookingDraftControllerProvider);
    final booking = flow.createdBooking;
    final payState = ref.watch(paymentControllerProvider);
    ref.listen(paymentControllerProvider, (_, next) {
      if (next.isFailure) context.showSnack(next.failure?.message ?? 'Payment failed');
      if (next.isSuccess) onPaid();
    });

    if (booking == null) return const Center(child: Text('No booking to pay for.'));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Payment', style: context.text.titleLarge),
          const SizedBox(height: 8),
          Text('Booking #${booking.id.substring(0, 8)} created. Complete payment to confirm your visit.', style: context.text.bodyMedium),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Amount due', style: context.text.titleMedium),
                  Text(Money.format(booking.price, currency: booking.currency), style: context.text.titleMedium),
                ],
              ),
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: payState.isSubmitting ? null : () => ref.read(paymentControllerProvider.notifier).payForBooking(booking),
            child: payState.isSubmitting
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                : const Text('Pay now'),
          ),
          const SizedBox(height: 8),
          TextButton(onPressed: onPaid, child: const Text('Pay later')),
        ],
      ),
    );
  }
}

// 10 — Confirmation
class _ConfirmationStep extends ConsumerWidget {
  const _ConfirmationStep();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booking = ref.watch(bookingDraftControllerProvider).createdBooking;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle, size: 96, color: context.colors.primary),
          const SizedBox(height: 16),
          Text('Booking confirmed!', style: context.text.headlineSmall),
          const SizedBox(height: 8),
          Text('We’ll notify you when a technician is on the way.', style: context.text.bodyMedium, textAlign: TextAlign.center),
          const SizedBox(height: 32),
          if (booking != null)
            FilledButton(
              onPressed: () {
                ref.read(bookingDraftControllerProvider.notifier).reset();
                ref.invalidate(bookingsProvider);
                context.go('/customer/bookings/${booking.id}');
              },
              child: const Text('View booking'),
            ),
          TextButton(
            onPressed: () {
              ref.read(bookingDraftControllerProvider.notifier).reset();
              context.go('/customer');
            },
            child: const Text('Back to home'),
          ),
        ],
      ),
    );
  }
}
