// lib/features/customer/shared/data/booking_repository.dart
//
// Catalog (services) + booking lifecycle. Returns Result<T>; transport errors → Failures
// via FailureMapper. Booking creation sends an Idempotency-Key (API spec requirement) so
// a retried POST can't double-book.

import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../models/customer_models.dart';
import 'customer_endpoints.dart';

class CatalogRepository {
  final Dio _dio;
  CatalogRepository(this._dio);

  Future<Result<List<Service>>> listServices({String? category, String? search}) async {
    try {
      final res = await _dio.get(CustomerEndpoints.services, queryParameters: {
        if (category != null) 'category': category,
        if (search != null && search.isNotEmpty) 'search': search,
        'limit': 100,
      });
      final page = Paginated.fromJson(_asMap(res.data), Service.fromJson);
      return Success(page.data);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Map<String, dynamic> _asMap(dynamic d) => d is Map<String, dynamic> ? d : <String, dynamic>{};
}

class BookingRepository {
  final Dio _dio;
  BookingRepository(this._dio);

  Map<String, dynamic> _asMap(dynamic d) => d is Map<String, dynamic> ? d : <String, dynamic>{};
  Map<String, dynamic> _unwrap(dynamic d) {
    final m = _asMap(d);
    return m['data'] is Map<String, dynamic> ? m['data'] as Map<String, dynamic> : m;
  }

  Future<Result<Paginated<Booking>>> list({String? status, int page = 1, int limit = 20}) async {
    try {
      final res = await _dio.get(CustomerEndpoints.bookings, queryParameters: {
        if (status != null) 'status': status,
        'page': page,
        'limit': limit,
      });
      return Success(Paginated.fromJson(_asMap(res.data), Booking.fromJson));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Booking>> detail(String id) async {
    try {
      final res = await _dio.get(CustomerEndpoints.booking(id));
      return Success(Booking.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Booking>> create({
    required String serviceId,
    required String addressId,
    required DateTime windowStart,
    required DateTime windowEnd,
    String? couponCode,
    String? notes,
    required String idempotencyKey,
  }) async {
    try {
      final res = await _dio.post(
        CustomerEndpoints.bookings,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
        data: {
          'service_id': serviceId,
          'address_id': addressId,
          'scheduled_window_start': windowStart.toUtc().toIso8601String(),
          'scheduled_window_end': windowEnd.toUtc().toIso8601String(),
          if (couponCode != null && couponCode.isNotEmpty) 'coupon_code': couponCode,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      return Success(Booking.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Booking>> reschedule({required String id, required DateTime windowStart, required DateTime windowEnd}) async {
    try {
      final res = await _dio.patch(CustomerEndpoints.booking(id), data: {
        'scheduled_window_start': windowStart.toUtc().toIso8601String(),
        'scheduled_window_end': windowEnd.toUtc().toIso8601String(),
      });
      return Success(Booking.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> cancel({required String id, String? reason}) async {
    try {
      await _dio.post(CustomerEndpoints.cancelBooking(id), data: {if (reason != null) 'reason': reason});
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}
