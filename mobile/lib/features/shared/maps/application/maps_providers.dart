// lib/features/shared/maps/application/maps_providers.dart
//
// DI + read providers for the shared maps services. `currentLocationProvider` is
// autoDispose so each screen gets a fresh fix; `reverseGeocodeProvider` is a family keyed
// by coordinates for address labels on tracking/booking screens.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../../core/network/result.dart';
import '../data/maps_repository.dart';

final mapsRepositoryProvider = Provider<MapsRepository>((ref) => MapsRepository());

T _orThrow<T>(Result<T> r) => r.when(success: (d) => d, failure: (f) => throw f);

/// Current device location (throws a Failure on permission/lookup error → AsyncError).
final currentLocationProvider = FutureProvider.autoDispose<LatLng>((ref) async {
  return _orThrow(await ref.watch(mapsRepositoryProvider).currentLocation());
});

/// Reverse-geocoded address for a coordinate pair.
final reverseGeocodeProvider =
    FutureProvider.autoDispose.family<PlaceAddress, ({double lat, double lng})>((ref, p) async {
  return _orThrow(await ref.watch(mapsRepositoryProvider).reverseGeocode(p.lat, p.lng));
});
