// lib/shared/data/notifications_repository.dart
//
// User-scoped notifications are identical across roles, so this lives in shared. Exposes a
// repository + providers reused by technician (and migratable from the customer feature).

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/error/failure_mapper.dart';
import '../../core/network/result.dart';
import '../../providers/core_providers.dart';

class AppNotification {
  final String id;
  final String type;
  final String title;
  final String? body;
  final bool read;
  final DateTime? createdAt;
  const AppNotification({required this.id, required this.type, required this.title, this.body, this.read = false, this.createdAt});

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'].toString(),
        type: j['type']?.toString() ?? 'IN_APP',
        title: j['title']?.toString() ?? '',
        body: j['body']?.toString(),
        read: j['read_at'] != null || j['read'] == true,
        createdAt: j['created_at'] == null ? null : DateTime.tryParse(j['created_at'].toString()),
      );
}

class NotificationsRepository {
  final Dio _dio;
  NotificationsRepository(this._dio);

  Future<Result<List<AppNotification>>> list({bool unreadOnly = false}) async {
    try {
      final res = await _dio.get('/notifications', queryParameters: {if (unreadOnly) 'unread': true, 'limit': 50});
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(AppNotification.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> markRead(String id) async {
    try {
      await _dio.patch('/notifications/$id/read');
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> markAllRead() async {
    try {
      await _dio.post('/notifications/read-all');
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

final notificationsRepositoryProvider = Provider((ref) => NotificationsRepository(ref.watch(dioProvider)));

final notificationsListProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final r = await ref.watch(notificationsRepositoryProvider).list();
  return r.when(success: (d) => d, failure: (f) => throw f);
});

final unreadNotificationsCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final r = await ref.watch(notificationsRepositoryProvider).list(unreadOnly: true);
  return r.when(success: (d) => d.length, failure: (_) => 0);
});
