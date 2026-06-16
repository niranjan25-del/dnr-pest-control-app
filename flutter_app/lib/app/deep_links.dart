// lib/app/deep_links.dart
//
// Global navigator + messenger keys (so code outside the widget tree — e.g. a notification
// tap — can navigate / show banners) and a DeepLinkService that maps an FCM data payload to
// an in-app route. GoRouter already handles URL/path deep links; this covers push taps.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_controller.dart';
import '../core/constants/app_constants.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>(debugLabel: 'messenger');

class DeepLinkService {
  final Ref _ref;
  DeepLinkService(this._ref);

  /// Translate a notification data map into a route and navigate. Examples:
  ///   {type: BOOKING_*, booking_id} → role-aware booking/job detail
  ///   {type: CHAT_*, conversation_id} → /chat/:id
  void handleNotificationData(Map<String, dynamic> data) {
    final route = routeForData(data);
    if (route != null) rootNavigatorKey.currentContext?.push(route);
  }

  String? routeForData(Map<String, dynamic> data) {
    final type = (data['type'] ?? '').toString().toUpperCase();
    final role = _ref.read(authControllerProvider).role;

    if (type.contains('CHAT') && data['conversation_id'] != null) {
      return '/chat/${data['conversation_id']}';
    }
    if (type.contains('BOOKING') || type.contains('JOB') || type.contains('TECHNICIAN')) {
      final bookingId = data['booking_id'];
      if (bookingId == null) return null;
      return role == AppRole.technician ? '/technician/jobs/$bookingId' : '/customer/bookings/$bookingId';
    }
    if (type.contains('PAYMENT') || type.contains('INVOICE')) return '/payments/history';
    return null;
  }
}

final deepLinkServiceProvider = Provider<DeepLinkService>((ref) => DeepLinkService(ref));
