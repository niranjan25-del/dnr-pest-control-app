// lib/features/shared/payments/application/payments_controller.dart
//
// Shared payments: payment history (paid invoices), saved payment methods, and a reusable
// checkout (Stripe PaymentSheet) for an invoice. Card details never touch our API.
//
// NOTE (flagged): saved-method listing/add/remove needs backend endpoints (e.g.
// /payments/methods via a Stripe SetupIntent). Those aren't in the API Spec yet, so the
// saved-methods calls below target sensible paths and degrade gracefully (empty list).

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/result.dart';
import '../../../../providers/core_providers.dart';
import '../../../../shared/state/submission_state.dart';

class InvoiceSummary {
  final String id;
  final String number;
  final String total;
  final String currency;
  final String status;
  final DateTime? issuedAt;
  const InvoiceSummary({required this.id, required this.number, required this.total, required this.currency, required this.status, this.issuedAt});

  factory InvoiceSummary.fromJson(Map<String, dynamic> j) => InvoiceSummary(
        id: j['id'].toString(),
        number: (j['invoice_number'] ?? j['number'] ?? j['id']).toString(),
        total: (j['total_amount'] ?? j['total'] ?? '0').toString(),
        currency: j['currency']?.toString() ?? 'INR',
        status: j['status']?.toString() ?? 'ISSUED',
        issuedAt: j['created_at'] == null ? null : DateTime.tryParse(j['created_at'].toString()),
      );
}

class SavedCard {
  final String id;
  final String brand;
  final String last4;
  final int? expMonth;
  final int? expYear;
  const SavedCard({required this.id, required this.brand, required this.last4, this.expMonth, this.expYear});

  factory SavedCard.fromJson(Map<String, dynamic> j) => SavedCard(
        id: j['id'].toString(),
        brand: (j['brand'] ?? 'card').toString(),
        last4: (j['last4'] ?? '••••').toString(),
        expMonth: (j['exp_month'] as num?)?.toInt(),
        expYear: (j['exp_year'] as num?)?.toInt(),
      );
}

class PaymentsRepository {
  final Dio _dio;
  PaymentsRepository(this._dio);

  Future<Result<List<InvoiceSummary>>> history() async {
    try {
      final res = await _dio.get('/invoices', queryParameters: {'limit': 50});
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(InvoiceSummary.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<List<SavedCard>>> savedCards() async {
    try {
      final res = await _dio.get('/payments/methods'); // FLAG: backend endpoint TBD
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(SavedCard.fromJson).toList());
    } catch (_) {
      return const Success([]); // degrade gracefully until the endpoint exists
    }
  }

  Future<Result<String>> setupIntent() async {
    try {
      final res = await _dio.post('/payments/setup-intent'); // FLAG: backend endpoint TBD
      final m = res.data is Map ? (res.data['data'] ?? res.data) as Map : const {};
      return Success((m['client_secret'] ?? '').toString());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

final paymentsRepositoryProvider = Provider((ref) => PaymentsRepository(ref.watch(dioProvider)));

final paymentHistoryProvider = FutureProvider.autoDispose<List<InvoiceSummary>>((ref) async {
  return (await ref.watch(paymentsRepositoryProvider).history()).when(success: (d) => d, failure: (f) => throw f);
});

final savedCardsProvider = FutureProvider.autoDispose<List<SavedCard>>((ref) async {
  return (await ref.watch(paymentsRepositoryProvider).savedCards()).when(success: (d) => d, failure: (_) => const []);
});

/// Add a card via Stripe SetupIntent + PaymentSheet (when the backend endpoint exists).
class SavedMethodsController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  SavedMethodsController(this._ref) : super(const SubmissionState.idle());

  Future<bool> addCard() async {
    state = const SubmissionState.submitting();
    final res = await _ref.read(paymentsRepositoryProvider).setupIntent();
    final secret = res.dataOrNull;
    if (res is FailureResult || secret == null || secret.isEmpty) {
      state = const SubmissionState.error(ServerFailure('Adding cards isn’t available yet.'));
      return false;
    }
    try {
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(setupIntentClientSecret: secret, merchantDisplayName: 'DNR Pest Control'),
      );
      await Stripe.instance.presentPaymentSheet();
      _ref.invalidate(savedCardsProvider);
      state = const SubmissionState.success();
      return true;
    } catch (_) {
      state = const SubmissionState.error(ValidationFailure('Card setup cancelled'));
      return false;
    }
  }
}

final savedMethodsControllerProvider =
    StateNotifierProvider.autoDispose<SavedMethodsController, SubmissionState>((ref) => SavedMethodsController(ref));
