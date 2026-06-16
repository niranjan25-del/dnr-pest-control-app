// lib/features/customer/subscriptions/subscription_repository.dart
//
// Subscription data access (customer-scoped). Matches the AccountRepository conventions:
// shared Dio, Result<T> outcomes, and the {data:{…}} unwrap. Backend (Step 11) exposes
// GET /subscriptions, GET /subscriptions/:id, and POST :id/{pause,resume,cancel}.

import 'package:dio/dio.dart';
import '../../../core/error/failure_mapper.dart';
import '../../../core/network/result.dart';
import '../shared/data/customer_endpoints.dart';
import '../shared/models/subscription_models.dart';

class SubscriptionRepository {
  final Dio _dio;
  SubscriptionRepository(this._dio);

  Map<String, dynamic> _unwrap(dynamic d) {
    final m = d is Map<String, dynamic> ? d : <String, dynamic>{};
    return m['data'] is Map<String, dynamic> ? m['data'] as Map<String, dynamic> : m;
  }

  Future<Result<List<Subscription>>> list() async {
    try {
      final res = await _dio.get(CustomerEndpoints.subscriptions);
      final data = res.data is Map ? res.data['data'] : res.data;
      // Tolerate either a bare list or a paginated { data: [...] } shape.
      final list = (data is Map ? data['data'] : data) as List? ?? (data as List? ?? const []);
      return Success(list.whereType<Map<String, dynamic>>().map(Subscription.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Subscription>> detail(String id) async {
    try {
      final res = await _dio.get(CustomerEndpoints.subscription(id));
      return Success(Subscription.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Subscription>> _action(String path) async {
    try {
      final res = await _dio.post(path);
      return Success(Subscription.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<Subscription>> pause(String id) => _action(CustomerEndpoints.pauseSubscription(id));
  Future<Result<Subscription>> resume(String id) => _action(CustomerEndpoints.resumeSubscription(id));

  Future<Result<Subscription>> cancel(String id, {String? reason}) async {
    try {
      final res = await _dio.post(
        CustomerEndpoints.cancelSubscription(id),
        data: reason == null ? null : {'reason': reason},
      );
      return Success(Subscription.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}
