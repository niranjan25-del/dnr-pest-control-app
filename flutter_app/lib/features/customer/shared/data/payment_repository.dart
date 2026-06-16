// lib/features/customer/shared/data/payment_repository.dart
//
// Payment intent + confirm. The booking flow: create booking → resolve its invoice →
// create a PaymentIntent (client_secret) → Stripe PaymentSheet → confirm. No card data
// ever touches our API (Stripe handles it).

import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../models/customer_models.dart';
import 'customer_endpoints.dart';

class PaymentRepository {
  final Dio _dio;
  PaymentRepository(this._dio);

  Map<String, dynamic> _unwrap(dynamic d) {
    final m = d is Map<String, dynamic> ? d : <String, dynamic>{};
    return m['data'] is Map<String, dynamic> ? m['data'] as Map<String, dynamic> : m;
  }

  /// Resolve the invoice id for a booking (booking detail may already carry it; otherwise
  /// query invoices by booking). Returns null if none yet (e.g. invoice still generating).
  Future<Result<String?>> invoiceIdForBooking(String bookingId, {String? known}) async {
    if (known != null && known.isNotEmpty) return Success(known);
    try {
      final res = await _dio.get(CustomerEndpoints.invoices, queryParameters: {'booking_id': bookingId, 'limit': 1});
      final list = (res.data is Map ? res.data['data'] : null) as List? ?? const [];
      final first = list.whereType<Map<String, dynamic>>().firstOrNull;
      return Success(first?['id']?.toString());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<PaymentIntentResult>> createIntent({required String invoiceId, required String idempotencyKey}) async {
    try {
      final res = await _dio.post(
        CustomerEndpoints.paymentsIntent,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
        data: {'invoice_id': invoiceId},
      );
      return Success(PaymentIntentResult.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> confirm(String paymentId) async {
    try {
      await _dio.post(CustomerEndpoints.confirmPayment(paymentId));
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
