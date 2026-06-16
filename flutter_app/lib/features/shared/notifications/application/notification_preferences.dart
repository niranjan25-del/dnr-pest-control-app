// lib/features/shared/notifications/application/notification_preferences.dart
//
// Notification preferences: per-channel toggles (push/email/sms). Backed by
// GET/PATCH /notifications/preferences.
//
// NOTE (flagged): the backend NotificationPreference model/endpoint was a *flagged* schema
// addition (Step 28) and may not exist yet. This controller degrades gracefully —
// defaults to all-on and persists locally — until the endpoint is live.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../../../../providers/core_providers.dart';

class NotificationPrefs {
  final bool push;
  final bool email;
  final bool sms;
  const NotificationPrefs({this.push = true, this.email = true, this.sms = false});

  NotificationPrefs copyWith({bool? push, bool? email, bool? sms}) =>
      NotificationPrefs(push: push ?? this.push, email: email ?? this.email, sms: sms ?? this.sms);

  Map<String, dynamic> toJson() => {'push': push, 'email': email, 'sms': sms};
  factory NotificationPrefs.fromJson(Map<String, dynamic> j) =>
      NotificationPrefs(push: j['push'] != false, email: j['email'] != false, sms: j['sms'] == true);
}

class NotificationPrefsController extends StateNotifier<NotificationPrefs> {
  final Dio _dio;
  static const _localKey = 'notif_prefs';
  NotificationPrefsController(this._dio) : super(const NotificationPrefs()) {
    _load();
  }

  Future<void> _load() async {
    // Try server, fall back to local.
    try {
      final res = await _dio.get('/notifications/preferences');
      final m = res.data is Map ? (res.data['data'] ?? res.data) as Map<String, dynamic> : <String, dynamic>{};
      state = NotificationPrefs.fromJson(m);
      return;
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_localKey);
      if (raw != null) state = NotificationPrefs.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    }
  }

  Future<void> update({bool? push, bool? email, bool? sms}) async {
    state = state.copyWith(push: push, email: email, sms: sms);
    // Persist locally always; best-effort server sync.
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localKey, jsonEncode(state.toJson()));
    try {
      await _dio.patch('/notifications/preferences', data: state.toJson());
    } catch (_) {/* offline / endpoint absent — local persists */}
  }
}

final notificationPrefsProvider =
    StateNotifierProvider<NotificationPrefsController, NotificationPrefs>((ref) => NotificationPrefsController(ref.watch(dioProvider)));
