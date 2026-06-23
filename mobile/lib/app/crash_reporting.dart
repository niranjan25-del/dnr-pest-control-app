// lib/app/crash_reporting.dart
//
// Crash-reporting abstraction with a Noop default. This is the single integration point
// for Crashlytics or Sentry: implement CrashReporter and override the provider in
// bootstrap. Keeping it abstract means the app doesn't hard-depend on a vendor and tests
// stay clean.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../utils/app_logger.dart';

abstract interface class CrashReporter {
  Future<void> initialize();
  Future<void> recordError(Object error, StackTrace? stack, {bool fatal});
  void log(String message);
  Future<void> setUser({String? id, String? role});
}

/// Default: logs only. Swap for a real implementation (Crashlytics/Sentry) via the provider.
class NoopCrashReporter implements CrashReporter {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> recordError(Object error, StackTrace? stack, {bool fatal = false}) async {
    AppLogger.e('CrashReporter${fatal ? '(FATAL)' : ''}', error, stack);
  }

  @override
  void log(String message) => AppLogger.d('Crash breadcrumb: $message');

  @override
  Future<void> setUser({String? id, String? role}) async {}
}

/// Overridden in bootstrap with the chosen vendor implementation.
final crashReporterProvider = Provider<CrashReporter>((ref) => NoopCrashReporter());
