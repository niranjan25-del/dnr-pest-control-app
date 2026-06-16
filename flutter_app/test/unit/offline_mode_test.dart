// test/unit/offline_mode_test.dart
//
// Offline behavior: when connectivity reports offline, a read repository should serve cached
// data (and writes should surface a NetworkFailure rather than hang). This sample shows the
// pattern with a mocked connectivity source + cache; wire the real provider names from the
// foundation (e.g. connectivityProvider / a cache datasource).
//
// FLAG: adjust types to the app's actual connectivity + cache abstractions.

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:dnr_pest_control/core/network/result.dart';
import 'package:dnr_pest_control/core/error/failures.dart';

// Minimal interfaces to illustrate the contract under test.
abstract class ConnectivitySource {
  Future<bool> get isOnline;
}

abstract class BookingCache {
  Future<List<Map<String, dynamic>>> readBookings();
}

class MockConnectivity extends Mock implements ConnectivitySource {}
class MockBookingCache extends Mock implements BookingCache {}

/// Example repository method whose behavior we assert.
Future<Result<List<Map<String, dynamic>>>> loadBookings(
  ConnectivitySource net,
  BookingCache cache,
) async {
  if (!await net.isOnline) {
    final cached = await cache.readBookings();
    if (cached.isEmpty) return const FailureResult(NetworkFailure('offline, no cache'));
    return Success(cached);
  }
  return const FailureResult(NetworkFailure('network path not exercised here'));
}

void main() {
  late MockConnectivity net;
  late MockBookingCache cache;

  setUp(() {
    net = MockConnectivity();
    cache = MockBookingCache();
  });

  test('serves cached bookings when offline', () async {
    when(() => net.isOnline).thenAnswer((_) async => false);
    when(() => cache.readBookings()).thenAnswer((_) async => [
          {'id': 'b1', 'status': 'PENDING'},
        ]);

    final result = await loadBookings(net, cache);
    expect(result.isSuccess, isTrue);
    expect(result.dataOrNull, hasLength(1));
  });

  test('returns NetworkFailure when offline and cache is empty', () async {
    when(() => net.isOnline).thenAnswer((_) async => false);
    when(() => cache.readBookings()).thenAnswer((_) async => []);

    final result = await loadBookings(net, cache);
    expect(result, isA<FailureResult>());
    expect(result.failureOrNull, isA<NetworkFailure>());
  });
}
