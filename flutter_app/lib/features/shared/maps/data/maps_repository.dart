// lib/features/shared/maps/data/maps_repository.dart
//
// Device-side maps services shared by both apps: current GPS position (geolocator) and
// forward/reverse geocoding (geocoding). All return Result<T> so callers handle
// permission/lookup failures uniformly via FailureMapper-style domain failures.
//
// NOTE on "route rendering": drawing a true turn-by-turn polyline requires the Google
// Directions API (an HTTP call + an API key). This repository exposes the geocoding +
// position primitives and a straight-line fallback; wire a Directions call into
// `routePolyline` when a server proxy/key is available (kept out to avoid leaking a key
// into the client). The tracking map already renders marker + live position today.

import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/result.dart';

class PlaceAddress {
  final String formatted;
  final String? street;
  final String? city;
  final String? state;
  final String? postalCode;
  final double latitude;
  final double longitude;
  const PlaceAddress({
    required this.formatted,
    required this.latitude,
    required this.longitude,
    this.street,
    this.city,
    this.state,
    this.postalCode,
  });
}

class MapsRepository {
  /// Ensures location permission, then returns the current device position.
  Future<Result<LatLng>> currentLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const FailureResult(PermissionFailure('Location services are disabled.'));
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return const FailureResult(PermissionFailure('Location permission denied.'));
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      return Success(LatLng(pos.latitude, pos.longitude));
    } catch (e) {
      return FailureResult(_mapError(e));
    }
  }

  /// Reverse geocode: coordinates → a human-readable address.
  Future<Result<PlaceAddress>> reverseGeocode(double lat, double lng) async {
    try {
      final marks = await placemarkFromCoordinates(lat, lng);
      if (marks.isEmpty) return const FailureResult(ServerFailure('No address found for that location.'));
      final m = marks.first;
      final parts = [m.street, m.subLocality, m.locality, m.administrativeArea, m.postalCode]
          .where((s) => s != null && s.trim().isNotEmpty)
          .toList();
      return Success(PlaceAddress(
        formatted: parts.join(', '),
        street: m.street,
        city: m.locality,
        state: m.administrativeArea,
        postalCode: m.postalCode,
        latitude: lat,
        longitude: lng,
      ));
    } catch (e) {
      return FailureResult(_mapError(e));
    }
  }

  /// Forward geocode: a free-text address → coordinates (+ normalized address).
  Future<Result<PlaceAddress>> geocodeAddress(String query) async {
    try {
      final locs = await locationFromAddress(query);
      if (locs.isEmpty) return const FailureResult(ServerFailure('Could not find that address.'));
      final l = locs.first;
      // Enrich with a reverse lookup so callers get a normalized formatted string.
      final enriched = await reverseGeocode(l.latitude, l.longitude);
      return enriched.when(
        success: (a) => Success(a),
        failure: (_) => Success(PlaceAddress(formatted: query, latitude: l.latitude, longitude: l.longitude)),
      );
    } catch (e) {
      return FailureResult(_mapError(e));
    }
  }

  /// Straight-line fallback "route" (two points). Replace with a Directions API result
  /// for real road geometry when a key/proxy is available.
  List<LatLng> routePolyline(LatLng from, LatLng to) => [from, to];

  Failure _mapError(Object e) {
    final msg = e.toString();
    if (msg.contains('permission') || msg.contains('Permission')) return const PermissionFailure();
    return ServerFailure('Location lookup failed: $msg');
  }
}
