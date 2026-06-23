// lib/app/crashlytics_reporter.dart
//
// Concrete CrashReporter backed by Firebase Crashlytics — the vendor implementation the
// crash_reporting.dart abstraction is designed to receive. Additive: it does not modify the
// abstraction or bootstrap. To activate, override the provider + route framework errors in
// bootstrap() (3 lines, shown below) so this captures fatals, non-fatals, and breadcrumbs.
//
// WIRING (in bootstrap.dart, kept out of here to avoid regenerating the foundation):
//
//   final crash = CrashlyticsCrashReporter();
//   await crash.initialize();
//   FlutterError.onError = (d) { AppLogger.e('FlutterError', d.exception, d.stack);
//                                crash.recordFlutterError(d); };
//   PlatformDispatcher.instance.onError = (e, s) { crash.recordError(e, s, fatal: true); return true; };
//   // then add to the returned overrides:
//   crashReporterProvider.overrideWithValue(crash),
//
// In prod, gate collection on a non-debug build; in dev it can stay disabled.

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'crash_reporting.dart';

class CrashlyticsCrashReporter implements CrashReporter {
  final FirebaseCrashlytics _crashlytics;
  CrashlyticsCrashReporter([FirebaseCrashlytics? instance])
      : _crashlytics = instance ?? FirebaseCrashlytics.instance;

  @override
  Future<void> initialize() async {
    // Disable noisy collection in debug; enable for release/profile builds.
    await _crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);
  }

  @override
  Future<void> recordError(Object error, StackTrace? stack, {bool fatal = false}) {
    return _crashlytics.recordError(error, stack, fatal: fatal);
  }

  /// Convenience for Flutter framework errors (FlutterError.onError).
  Future<void> recordFlutterError(FlutterErrorDetails details) {
    return _crashlytics.recordFlutterError(details);
  }

  @override
  void log(String message) => _crashlytics.log(message);

  @override
  Future<void> setUser({String? id, String? role}) async {
    await _crashlytics.setUserIdentifier(id ?? '');
    if (role != null) await _crashlytics.setCustomKey('role', role);
  }
}
