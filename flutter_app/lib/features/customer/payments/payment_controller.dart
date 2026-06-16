// lib/features/customer/payments/payment_controller.dart
//
// Orchestrates checkout for a booking: resolve invoice → create PaymentIntent →
// Stripe PaymentSheet → confirm with the backend. All card entry happens in Stripe's
// sheet; we only ever hold the client_secret.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/result.dart';
import '../../../shared/state/submission_state.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

class PaymentController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  PaymentController(this._ref) : super(const SubmissionState.idle());

  /// Pay for [booking]. Returns true on a confirmed payment.
  Future<bool> payForBooking(Booking booking) async {
    state = const SubmissionState.submitting();
    final payments = _ref.read(paymentRepositoryProvider);

    // 1) Resolve the invoice for this booking.
    final invoiceRes = await payments.invoiceIdForBooking(booking.id, known: booking.invoiceId);
    final invoiceId = invoiceRes.dataOrNull;
    if (invoiceRes is FailureResult) {
      state = SubmissionState.error(invoiceRes.failure);
      return false;
    }
    if (invoiceId == null) {
      state = const SubmissionState.error(ServerFailure('Invoice is still being prepared. Try again shortly.'));
      return false;
    }

    // 2) Create the PaymentIntent.
    final key = 'pay-${booking.id}-${DateTime.now().millisecondsSinceEpoch}';
    final intentRes = await payments.createIntent(invoiceId: invoiceId, idempotencyKey: key);
    if (intentRes is FailureResult<PaymentIntentResult>) {
      state = SubmissionState.error(intentRes.failure);
      return false;
    }
    final intent = intentRes.dataOrNull!;

    // 3) Present Stripe PaymentSheet.
    try {
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: intent.clientSecret,
          merchantDisplayName: 'DNR Pest Control',
        ),
      );
      await Stripe.instance.presentPaymentSheet();
    } on StripeException catch (e) {
      // User cancelled or card declined.
      state = SubmissionState.error(ValidationFailure(e.error.localizedMessage ?? 'Payment cancelled'));
      return false;
    } catch (_) {
      state = const SubmissionState.error(UnknownFailure('Payment could not be completed.'));
      return false;
    }

    // 4) Confirm with the backend (records payment, updates invoice).
    final confirmRes = await payments.confirm(intent.paymentId);
    return confirmRes.when(
      success: (_) {
        state = const SubmissionState.success();
        return true;
      },
      failure: (f) {
        // Payment likely succeeded at Stripe; the webhook reconciles. Surface softly.
        state = SubmissionState.error(f);
        return false;
      },
    );
  }
}

final paymentControllerProvider =
    StateNotifierProvider.autoDispose<PaymentController, SubmissionState>((ref) => PaymentController(ref));
