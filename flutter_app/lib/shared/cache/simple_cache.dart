// lib/shared/cache/simple_cache.dart
//
// Lightweight JSON cache (SharedPreferences-backed) with TTL, for offline-friendly reads:
// stash the last successful payload for a key and read it back when the network is down.
// Use for lists like conversations/notifications where slightly-stale data beats a spinner.

import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SimpleCache {
  static const _prefix = 'cache:';

  Future<void> put(String key, Object json, {Duration ttl = const Duration(hours: 6)}) async {
    final prefs = await SharedPreferences.getInstance();
    final envelope = {'exp': DateTime.now().add(ttl).millisecondsSinceEpoch, 'data': json};
    await prefs.setString('$_prefix$key', jsonEncode(envelope));
  }

  /// Returns the cached value if present and unexpired; otherwise null.
  Future<dynamic> get(String key, {bool allowStale = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_prefix$key');
    if (raw == null) return null;
    final env = jsonDecode(raw) as Map<String, dynamic>;
    final expired = DateTime.now().millisecondsSinceEpoch > (env['exp'] as int);
    if (expired && !allowStale) return null;
    return env['data'];
  }

  Future<void> evict(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefix$key');
  }
}

final simpleCacheProvider = Provider<SimpleCache>((ref) => SimpleCache());
