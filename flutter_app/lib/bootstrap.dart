// lib/bootstrap.dart
//
// Centralized async initialization, run before the first frame, inside a guarded zone so
// uncaught errors are routed to the logger (wire Crashlytics/Sentry here later). Returns
// the ProviderScope overrides for values that must be ready synchronously.

import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'config/app_environment.dart';
import 'providers/core_providers.dart';
import 'services/preferences_service.dart';
import 'services/push_notification_service.dart';
import 'utils/app_logger.dart';

class BootstrapResult {
  final List<Override> overrides;
  const BootstrapResult(this.overrides);
}

Future<BootstrapResult> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final env = AppEnvironment.fromDartDefine();
  AppLogger.enabled = env.enableLogging;

  // Firebase + FCM background handler (must be registered before runApp).
  // Silently skipped when google-services.json / GoogleService-Info.plist are absent
  // (e.g., CI or dev machines that haven't set up Firebase).
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    AppLogger.w('Firebase not configured — push notifications disabled. $e');
  }

  // Stripe publishable key (PaymentSheet initialized in the payments feature).
  if (env.stripePublishableKey.isNotEmpty) {
    Stripe.publishableKey = env.stripePublishableKey;
  }

  // Async singletons that must be ready synchronously for providers.
  final prefs = await PreferencesService.create();

  // Surface global Flutter framework errors to the logger.
  FlutterError.onError = (details) {
    AppLogger.e('FlutterError', details.exception, details.stack);
  };

  return BootstrapResult([
    environmentProvider.overrideWithValue(env),
    preferencesServiceProvider.overrideWithValue(prefs),
  ]);
}
