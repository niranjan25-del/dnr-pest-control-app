// lib/features/shared/maps/application/tracking_controller.dart
//
// Live technician tracking for a booking. Connects the Socket.IO /location namespace,
// joins the booking room (track:join), and streams technician position + ETA + arrival.
// Falls back to a REST poll of GET /bookings/{id}/technician-location if the socket isn't
// available. Used by the customer's "track my technician" view.

import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../../config/app_environment.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../../../../providers/core_providers.dart';
import '../../../../services/secure_storage_service.dart';
import '../../../../utils/app_logger.dart';
import 'package:dio/dio.dart';

class TechLocation {
  final double latitude;
  final double longitude;
  final String? status;
  final DateTime? recordedAt;
  const TechLocation({required this.latitude, required this.longitude, this.status, this.recordedAt});

  factory TechLocation.fromJson(Map<String, dynamic> j) => TechLocation(
        latitude: double.tryParse(j['latitude'].toString()) ?? 0,
        longitude: double.tryParse(j['longitude'].toString()) ?? 0,
        status: j['status']?.toString(),
        recordedAt: j['recorded_at'] == null ? null : DateTime.tryParse(j['recorded_at'].toString()),
      );
}

class Eta {
  final int durationSeconds;
  final int distanceMeters;
  const Eta(this.durationSeconds, this.distanceMeters);
  String get pretty {
    final mins = (durationSeconds / 60).round();
    return mins <= 1 ? 'Arriving now' : '$mins min away';
  }
}

class TrackingState {
  final TechLocation? location;
  final Eta? eta;
  final bool arrived;
  final bool connected;
  const TrackingState({this.location, this.eta, this.arrived = false, this.connected = false});
  TrackingState copyWith({TechLocation? location, Eta? eta, bool? arrived, bool? connected}) =>
      TrackingState(location: location ?? this.location, eta: eta ?? this.eta, arrived: arrived ?? this.arrived, connected: connected ?? this.connected);
}

class TrackingController extends StateNotifier<TrackingState> {
  final Ref _ref;
  final String bookingId;
  io.Socket? _socket;
  Timer? _pollTimer;

  TrackingController(this._ref, this.bookingId) : super(const TrackingState()) {
    _start();
  }

  Future<void> _start() async {
    final env = _ref.read(environmentProvider);
    final token = await _ref.read(secureStorageProvider).readAccessToken();
    _socket = io.io(
      '${env.wsBaseUrl}/location',
      io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().setAuth({'token': token}).build(),
    );
    _socket!
      ..onConnect((_) {
        state = state.copyWith(connected: true);
        _socket!.emit('track:join', {'booking_id': bookingId});
      })
      ..onDisconnect((_) => state = state.copyWith(connected: false))
      ..on('location:technician', (d) {
        if (d is Map) state = state.copyWith(location: TechLocation.fromJson(Map<String, dynamic>.from(d)));
      })
      ..on('location:eta', (d) {
        if (d is Map) state = state.copyWith(eta: Eta((d['duration_seconds'] as num?)?.toInt() ?? 0, (d['distance_meters'] as num?)?.toInt() ?? 0));
      })
      ..on('location:arrived', (_) => state = state.copyWith(arrived: true))
      ..onConnectError((e) {
        AppLogger.w('Location socket error: $e — falling back to REST poll');
        _startPolling();
      });
    _socket!.connect();
  }

  // REST fallback if the socket can't connect.
  void _startPolling() {
    _pollTimer ??= Timer.periodic(const Duration(seconds: 20), (_) => _pollOnce());
    _pollOnce();
  }

  Future<void> _pollOnce() async {
    final res = await _ref.read(_techLocationRepoProvider).latest(bookingId);
    res.when(success: (loc) => state = state.copyWith(location: loc, arrived: loc.status?.toUpperCase() == 'ARRIVED'), failure: (_) {});
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _socket?.dispose();
    super.dispose();
  }
}

class _TechLocationRepo {
  final Dio _dio;
  _TechLocationRepo(this._dio);
  Future<Result<TechLocation>> latest(String bookingId) async {
    try {
      final res = await _dio.get('/bookings/$bookingId/technician-location');
      final m = res.data is Map ? (res.data['data'] ?? res.data) as Map<String, dynamic> : <String, dynamic>{};
      return Success(TechLocation.fromJson(m));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

final _techLocationRepoProvider = Provider((ref) => _TechLocationRepo(ref.watch(dioProvider)));

final trackingControllerProvider = StateNotifierProvider.autoDispose.family<TrackingController, TrackingState, String>(
  (ref, bookingId) => TrackingController(ref, bookingId),
);
