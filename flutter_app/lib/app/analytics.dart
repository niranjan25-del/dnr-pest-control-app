// lib/app/analytics.dart
//
// Analytics abstraction with a Noop default + a GoRouter NavigatorObserver that logs
// screen views automatically. Integration point for Firebase Analytics / Amplitude: swap
// the provider in bootstrap.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../utils/app_logger.dart';

abstract interface class AnalyticsService {
  Future<void> logEvent(String name, {Map<String, Object?> params});
  Future<void> logScreen(String screen);
  Future<void> setUser({String? id, String? role});
}

class NoopAnalytics implements AnalyticsService {
  @override
  Future<void> logEvent(String name, {Map<String, Object?> params = const {}}) async => AppLogger.d('analytics: $name $params');
  @override
  Future<void> logScreen(String screen) async => AppLogger.d('analytics: screen $screen');
  @override
  Future<void> setUser({String? id, String? role}) async {}
}

final analyticsProvider = Provider<AnalyticsService>((ref) => NoopAnalytics());

/// Logs each navigation as a screen view. Attached to GoRouter via `observers`.
class AnalyticsRouteObserver extends NavigatorObserver {
  final AnalyticsService analytics;
  AnalyticsRouteObserver(this.analytics);

  void _track(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name != null) analytics.logScreen(name);
  }

  @override
  void didPush(Route route, Route? previousRoute) => _track(route);
  @override
  void didReplace({Route? newRoute, Route? oldRoute}) => _track(newRoute);
  @override
  void didPop(Route route, Route? previousRoute) => _track(previousRoute);
}
