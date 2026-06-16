// lib/features/technician/shared/application/location_tracking_service.dart
//
// Streams device GPS during an active job and pings the backend (write-optimized 202),
// throttled for battery: high accuracy + a distance filter so we only emit on meaningful
// movement, and a minimum time gap between network sends. Pings are best-effort — if a
// send fails (offline), we simply skip it (location is transient; the durable outbox is
// reserved for status/report). Start on "En route", stop on "Completed".

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../utils/app_logger.dart';
import 'technician_providers.dart';

class LocationTrackingService {
  final Ref _ref;
  StreamSubscription<Position>? _sub;
  String? _bookingId;
  DateTime _lastSent = DateTime.fromMillisecondsSinceEpoch(0);
  static const _minGap = Duration(seconds: 15);

  LocationTrackingService(this._ref);

  bool get isTracking => _sub != null;

  Future<bool> _ensurePermission() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    return perm == LocationPermission.always || perm == LocationPermission.whileInUse;
  }

  Future<void> start(String bookingId) async {
    if (_sub != null) await stop();
    if (!await _ensurePermission()) {
      AppLogger.w('Location permission denied; tracking disabled');
      return;
    }
    _bookingId = bookingId;
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).listen(_onPosition);
    AppLogger.i('Location tracking started for $bookingId');
  }

  Future<void> _onPosition(Position p) async {
    final now = DateTime.now();
    if (now.difference(_lastSent) < _minGap) return; // time throttle (battery/network)
    _lastSent = now;
    final id = _bookingId;
    if (id == null) return;
    // Best-effort; ignore failures (transient data).
    await _ref.read(locationRepositoryProvider).ping(bookingId: id, lat: p.latitude, lng: p.longitude, at: now);
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    _bookingId = null;
    AppLogger.i('Location tracking stopped');
  }
}

final locationTrackingServiceProvider = Provider<LocationTrackingService>((ref) {
  final service = LocationTrackingService(ref);
  ref.onDispose(service.stop);
  return service;
});
