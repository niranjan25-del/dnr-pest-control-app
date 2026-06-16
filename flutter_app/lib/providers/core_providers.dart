// lib/providers/core_providers.dart
//
// Riverpod is the DI container. These are the foundational singletons every feature
// builds on. `environmentProvider` and `preferencesServiceProvider` are *overridden* in
// main() with values resolved during bootstrap (so they're ready synchronously).

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_environment.dart';
import '../core/network/dio_client.dart';
import '../services/preferences_service.dart';
import '../services/secure_storage_service.dart';
import '../services/push_notification_service.dart';
import 'auth_controller.dart';

/// Overridden in main() after AppEnvironment.fromDartDefine().
final environmentProvider = Provider<AppEnvironment>((ref) {
  throw UnimplementedError('environmentProvider must be overridden in main()');
});

/// Overridden in main() after PreferencesService.create().
final preferencesServiceProvider = Provider<PreferencesService>((ref) {
  throw UnimplementedError('preferencesServiceProvider must be overridden in main()');
});

final secureStorageProvider = Provider<SecureStorageService>((ref) => SecureStorageService());

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) => PushNotificationService());

/// The shared, configured Dio instance. A 401 that can't be refreshed triggers
/// `authControllerProvider.logout()`, which the router observes to redirect to sign-in.
final dioProvider = Provider<Dio>((ref) {
  final env = ref.watch(environmentProvider);
  final storage = ref.watch(secureStorageProvider);
  return DioClient.create(
    env: env,
    storage: storage,
    onSessionExpired: () => ref.read(authControllerProvider.notifier).onSessionExpired(),
  );
});
