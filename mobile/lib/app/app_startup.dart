// lib/app/app_startup.dart
//
// Mounted under ProviderScope as the MaterialApp.router `builder`. Performs post-mount
// startup that needs a live provider container: initializes push notifications, wires
// notification taps → deep links, keeps the offline sync alive, sets analytics/crash
// identity from auth, observes app lifecycle (flush outbox on resume), and shows an
// offline banner via the global ScaffoldMessenger.

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/extensions/context_extensions.dart';
import '../features/technician/shared/application/technician_providers.dart';
import '../providers/auth_controller.dart';
import '../providers/core_providers.dart';
import '../shared/network/connectivity_provider.dart';
import 'analytics.dart';
import 'crash_reporting.dart';
import 'deep_links.dart';

class AppStartup extends ConsumerStatefulWidget {
  final Widget child;
  const AppStartup({super.key, required this.child});
  @override
  ConsumerState<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends ConsumerState<AppStartup> with WidgetsBindingObserver {
  bool _bannerShown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    // Push notifications: permission + token + foreground display.
    await ref.read(pushNotificationServiceProvider).init();

    // Notification taps → deep link (cold start + background).
    final deepLinks = ref.read(deepLinkServiceProvider);
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) deepLinks.handleNotificationData(initial.data);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => deepLinks.handleNotificationData(m.data));

    // Keep the connectivity-driven offline outbox flush alive for technicians.
    ref.read(outboxSyncProvider);

    // Identity for analytics + crash reporting.
    final auth = ref.read(authControllerProvider);
    if (auth.userId != null) {
      await ref.read(analyticsProvider).setUser(id: auth.userId, role: auth.role.name);
      await ref.read(crashReporterProvider).setUser(id: auth.userId, role: auth.role.name);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Best-effort: flush any queued offline actions when returning to the app.
      ref.read(offlineOutboxProvider).flush(ref.read(dioProvider));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Offline banner via the global messenger (set on MaterialApp).
    ref.listen(connectivityProvider, (_, next) {
      final online = next.valueOrNull ?? true;
      final messenger = scaffoldMessengerKey.currentState;
      if (messenger == null) return;
      if (!online && !_bannerShown) {
        _bannerShown = true;
        messenger.showMaterialBanner(MaterialBanner(
          content: const Text('You’re offline — changes will sync when you reconnect.'),
          leading: const Icon(Icons.cloud_off),
          actions: [TextButton(onPressed: () {}, child: const Text('OK'))],
        ));
      } else if (online && _bannerShown) {
        _bannerShown = false;
        messenger.hideCurrentMaterialBanner();
      }
    });

    // Reflect auth identity changes to analytics/crash.
    ref.listen(authControllerProvider, (_, next) {
      ref.read(analyticsProvider).setUser(id: next.userId, role: next.role.name);
      ref.read(crashReporterProvider).setUser(id: next.userId, role: next.role.name);
    });

    return widget.child;
  }
}
