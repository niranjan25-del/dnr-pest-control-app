// lib/features/technician/shared/offline/offline_outbox.dart
//
// Durable offline queue for field actions that MUST NOT be lost when connectivity drops
// mid-job: status transitions and report submissions. Actions are persisted as JSON in
// SharedPreferences and flushed (in order) when the device is back online.
//
// Design: controllers try online first; on a network/timeout failure they enqueue and
// treat the action as optimistically done. A connectivity listener (see the sync provider)
// flushes the queue. Idempotency keys make replays safe.

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../utils/app_logger.dart';

enum OutboxKind { statusUpdate, reportSubmit }

class OutboxAction {
  final String id;
  final OutboxKind kind;
  final String method; // POST
  final String path;
  final Map<String, dynamic> body;
  final Map<String, String> headers;
  final int createdAtMs;

  OutboxAction({
    required this.id,
    required this.kind,
    required this.path,
    required this.body,
    this.method = 'POST',
    this.headers = const {},
    int? createdAtMs,
  }) : createdAtMs = createdAtMs ?? DateTime.now().millisecondsSinceEpoch;

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'method': method,
        'path': path,
        'body': body,
        'headers': headers,
        'createdAtMs': createdAtMs,
      };

  factory OutboxAction.fromJson(Map<String, dynamic> j) => OutboxAction(
        id: j['id'],
        kind: OutboxKind.values.firstWhere((k) => k.name == j['kind'], orElse: () => OutboxKind.statusUpdate),
        method: j['method'] ?? 'POST',
        path: j['path'],
        body: Map<String, dynamic>.from(j['body'] ?? {}),
        headers: Map<String, String>.from(j['headers'] ?? {}),
        createdAtMs: j['createdAtMs'],
      );
}

class OfflineOutbox {
  static const _key = 'technician_outbox_v1';

  Future<List<OutboxAction>> _read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    return list.map(OutboxAction.fromJson).toList();
  }

  Future<void> _write(List<OutboxAction> actions) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(actions.map((a) => a.toJson()).toList()));
  }

  Future<int> get pendingCount async => (await _read()).length;

  Future<void> enqueue(OutboxAction action) async {
    final actions = await _read();
    actions.add(action);
    await _write(actions);
    AppLogger.i('Outbox: queued ${action.kind.name} (${actions.length} pending)');
  }

  /// Flush in FIFO order. Stops on the first failure (likely still offline) so order is
  /// preserved; successfully-sent actions are removed.
  Future<void> flush(Dio dio) async {
    var actions = await _read();
    if (actions.isEmpty) return;
    actions.sort((a, b) => a.createdAtMs.compareTo(b.createdAtMs));

    final remaining = <OutboxAction>[...actions];
    for (final action in actions) {
      try {
        await dio.request(
          action.path,
          data: action.body,
          options: Options(method: action.method, headers: action.headers.isEmpty ? null : action.headers),
        );
        remaining.remove(action);
        await _write(remaining);
      } catch (e) {
        AppLogger.w('Outbox flush stopped: ${(e as Object)}');
        break; // keep order; retry later
      }
    }
  }

  Future<void> clear() async => _write([]);
}
