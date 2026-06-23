// lib/features/technician/shared/data/technician_repository.dart
//
// Technician profile, availability, assigned jobs, status transitions, and accept/decline.
// Status transitions can be enqueued offline by the workflow controller; this repo only
// performs the online call and returns Result<T>.

import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../models/technician_models.dart';

class TechnicianEndpoints {
  TechnicianEndpoints._();
  static const me = '/technicians/me';
  static const availability = '/technicians/me/availability';
  static const jobs = '/technicians/me/jobs';
  static String status(String bookingId) => '/bookings/$bookingId/status';
  static String accept(String bookingId) => '/bookings/$bookingId/accept'; // FLAG: map to assignment-accept
  static String decline(String bookingId) => '/bookings/$bookingId/decline';
  static const location = '/technicians/me/location';
  static String eta(String bookingId) => '/location/eta/$bookingId';
  static String report(String bookingId) => '/bookings/$bookingId/report';
  static const files = '/files';
}

class TechnicianRepository {
  final Dio _dio;
  TechnicianRepository(this._dio);

  Map<String, dynamic> _unwrap(dynamic d) {
    final m = d is Map<String, dynamic> ? d : <String, dynamic>{};
    return m['data'] is Map<String, dynamic> ? m['data'] as Map<String, dynamic> : m;
  }

  Future<Result<TechnicianProfile>> profile() async {
    try {
      final res = await _dio.get(TechnicianEndpoints.me);
      return Success(TechnicianProfile.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<TechnicianProfile>> setAvailability(bool available) async {
    try {
      final res = await _dio.patch(TechnicianEndpoints.availability, data: {'is_available': available});
      return Success(TechnicianProfile.fromJson(_unwrap(res.data)));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<List<Job>>> jobs({String? date, String? status}) async {
    try {
      final res = await _dio.get(TechnicianEndpoints.jobs, queryParameters: {
        if (date != null) 'date': date,
        if (status != null) 'status': status,
      });
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(Job.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  /// Online status transition. (The workflow controller decides whether to enqueue.)
  Future<Result<void>> updateStatus({required String bookingId, required String status, String? note}) async {
    try {
      await _dio.post(TechnicianEndpoints.status(bookingId), data: {'status': status, if (note != null) 'note': note});
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> accept(String bookingId) async {
    try {
      await _dio.post(TechnicianEndpoints.accept(bookingId));
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<void>> decline(String bookingId, {String? reason}) async {
    try {
      await _dio.post(TechnicianEndpoints.decline(bookingId), data: {if (reason != null) 'reason': reason});
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}
