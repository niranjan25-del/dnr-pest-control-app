// lib/features/customer/shared/data/account_repository.dart
//
// Addresses, profile, reviews, and notifications — the smaller customer resources grouped
// into one repository. All return Result<T>.

import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../models/customer_models.dart';
import 'customer_endpoints.dart';

class AccountRepository {
  final Dio _dio;
  AccountRepository(this._dio);

  Map<String, dynamic> _unwrap(dynamic d) {
    final m = d is Map<String, dynamic> ? d : <String, dynamic>{};
    return m['data'] is Map<String, dynamic> ? m['data'] as Map<String, dynamic> : m;
  }

  // ---- Addresses ----
  Future<Result<List<Address>>> listAddresses() async {
    try {
      final res = await _dio.get(CustomerEndpoints.addresses);
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(Address.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Address>> upsertAddress(Map<String, dynamic> body, {String? id}) async {
    try {
      final res = id == null
          ? await _dio.post(CustomerEndpoints.addresses, data: body)
          : await _dio.patch(CustomerEndpoints.address(id), data: body);
      return Success(Address.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> deleteAddress(String id) async {
    try {
      await _dio.delete(CustomerEndpoints.address(id));
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Address>> setDefaultAddress(String id) =>
      upsertAddress({'is_default': true}, id: id);

  // ---- Profile ----
  Future<Result<CustomerProfile>> profile() async {
    try {
      final res = await _dio.get(CustomerEndpoints.me);
      return Success(CustomerProfile.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<CustomerProfile>> updateProfile({String? fullName, String? phone, String? companyName}) async {
    try {
      final res = await _dio.patch(CustomerEndpoints.me, data: {
        if (fullName != null) 'full_name': fullName,
        if (phone != null) 'phone': phone,
        if (companyName != null) 'company_name': companyName,
      });
      return Success(CustomerProfile.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  // ---- Reviews ----
  Future<Result<ReviewItem>> submitReview({required String bookingId, required int rating, String? comment}) async {
    try {
      final res = await _dio.post(CustomerEndpoints.reviews, data: {
        'booking_id': bookingId,
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      });
      return Success(ReviewItem.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  // ---- Notifications ----
  Future<Result<Paginated<NotificationItem>>> notifications({bool unreadOnly = false, int page = 1}) async {
    try {
      final res = await _dio.get(CustomerEndpoints.notifications, queryParameters: {
        if (unreadOnly) 'unread': true,
        'page': page,
        'limit': 30,
      });
      final m = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : <String, dynamic>{};
      return Success(Paginated.fromJson(m, NotificationItem.fromJson));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> markRead(String id) async {
    try {
      await _dio.patch(CustomerEndpoints.readNotification(id));
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> markAllRead() async {
    try {
      await _dio.post(CustomerEndpoints.readAllNotifications);
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}
