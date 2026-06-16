// lib/utils/app_logger.dart
//
// Thin wrapper over `logger` with a global on/off (driven by AppEnvironment.enableLogging)
// so production builds stay quiet. Use AppLogger.* instead of print.

import 'package:logger/logger.dart';

class AppLogger {
  AppLogger._();
  static bool enabled = true;
  static final Logger _logger = Logger(printer: PrettyPrinter(methodCount: 0, errorMethodCount: 5));

  static void d(dynamic m) => enabled ? _logger.d(m) : null;
  static void i(dynamic m) => enabled ? _logger.i(m) : null;
  static void w(dynamic m) => enabled ? _logger.w(m) : null;
  static void e(dynamic m, [Object? error, StackTrace? st]) => enabled ? _logger.e(m, error: error, stackTrace: st) : null;
}
