// lib/main.dart
//
// Entry point. Runs bootstrap() inside a guarded zone, then mounts the app with the
// ProviderScope overrides resolved during bootstrap. A single entry point serves all
// flavors (the flavor is chosen via --dart-define=FLAVOR=...).

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'bootstrap.dart';
import 'utils/app_logger.dart';

Future<void> main() async {
  await runZonedGuarded(() async {
    final result = await bootstrap();
    runApp(ProviderScope(overrides: result.overrides, child: const DnrApp()));
  }, (error, stack) {
    AppLogger.e('Uncaught zone error', error, stack);
  });
}
