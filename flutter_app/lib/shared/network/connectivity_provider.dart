// lib/shared/network/connectivity_provider.dart
//
// App-wide online/offline awareness. Exposes a stream + current value so any feature can
// react (offline banner, gating sends, triggering retry-queue flushes).

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

bool _isOnline(List<ConnectivityResult> results) => results.any((r) => r != ConnectivityResult.none);

/// Streams `true` when online, `false` when fully offline.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final initial = await Connectivity().checkConnectivity();
  yield _isOnline(initial);
  yield* Connectivity().onConnectivityChanged.map(_isOnline);
});

/// Convenience synchronous read (defaults to online while resolving).
final isOnlineProvider = Provider<bool>((ref) => ref.watch(connectivityProvider).valueOrNull ?? true);
