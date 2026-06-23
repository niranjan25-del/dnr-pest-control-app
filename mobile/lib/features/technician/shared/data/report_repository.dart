// lib/features/technician/shared/data/report_repository.dart
//
// Service report submission per the API spec's offline-friendly contract: upload files to
// POST /files (photos as File, signature as bytes) to get ids, then POST one report to
// /bookings/{id}/report with chemicals + signature_file_id + photo_file_ids inline.
//
// Also carries the location-ping call (POST /technicians/me/location).
//
// NOTE (reconciliation): the backend Service Reports module (Step 33) exposes granular
// endpoints (/service-reports, /:id/chemicals, /:id/signature, /:id/submit). The client
// uses the consolidated /bookings/{id}/report from the API Spec because it accepts an
// offline-synced payload in one shot. Confirm the backend honors this entry point.

import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../../core/error/failure_mapper.dart';
import '../../../../core/network/result.dart';
import '../models/technician_models.dart';
import 'technician_repository.dart';

class ReportPayload {
  final String bookingId;
  final List<String> pestsFound;
  final List<String> areasTreated;
  final String? summary;
  final String? recommendations;
  final bool followUpRequired;
  final List<ChemicalEntry> chemicals;
  final String? signatureFileId;
  final String? signerName;
  final List<String> photoFileIds;

  const ReportPayload({
    required this.bookingId,
    this.pestsFound = const [],
    this.areasTreated = const [],
    this.summary,
    this.recommendations,
    this.followUpRequired = false,
    this.chemicals = const [],
    this.signatureFileId,
    this.signerName,
    this.photoFileIds = const [],
  });

  Map<String, dynamic> toBody() => {
        'pests_found': pestsFound,
        'areas_treated': areasTreated,
        if (summary != null) 'summary': summary,
        if (recommendations != null) 'recommendations': recommendations,
        'follow_up_required': followUpRequired,
        'chemical_applications': chemicals.map((c) => c.toJson()).toList(),
        if (signatureFileId != null) 'signature_file_id': signatureFileId,
        if (signerName != null) 'signer_name': signerName,
        'photo_file_ids': photoFileIds,
      };
}

class ReportRepository {
  final Dio _dio;
  ReportRepository(this._dio);

  Future<Result<String>> uploadPhoto(File file, {required String bookingId, required bool isBefore}) async {
    return _upload(
      MultipartFile.fromFileSync(file.path, filename: file.uri.pathSegments.last),
      relatedType: isBefore ? 'service_report_before' : 'service_report_after',
      relatedId: bookingId,
    );
  }

  Future<Result<String>> uploadSignature(Uint8List pngBytes, {required String bookingId}) async {
    return _upload(
      MultipartFile.fromBytes(pngBytes, filename: 'signature.png'),
      relatedType: 'service_report_signature',
      relatedId: bookingId,
    );
  }

  Future<Result<String>> _upload(MultipartFile file, {required String relatedType, required String relatedId}) async {
    try {
      final form = FormData.fromMap({'file': file, 'related_entity_type': relatedType, 'related_entity_id': relatedId});
      final res = await _dio.post(TechnicianEndpoints.files, data: form);
      final m = res.data is Map ? (res.data['data'] ?? res.data) as Map : const {};
      return Success(m['id'].toString());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  /// Online submit. The workflow controller enqueues to the outbox on network failure.
  Future<Result<void>> submitReport(ReportPayload payload) async {
    try {
      await _dio.post(TechnicianEndpoints.report(payload.bookingId), data: payload.toBody());
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  Future<Result<List<Job>>> reportHistory() async {
    // Reuse the jobs list filtered to completed for a lightweight "my reports" view.
    try {
      final res = await _dio.get(TechnicianEndpoints.jobs, queryParameters: {'status': 'COMPLETED'});
      final list = (res.data is Map ? res.data['data'] : res.data) as List? ?? const [];
      return Success(list.whereType<Map<String, dynamic>>().map(Job.fromJson).toList());
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

class LocationRepository {
  final Dio _dio;
  LocationRepository(this._dio);

  /// Live ETA from the technician's latest known position to the job site
  /// (GET /location/eta/:bookingId — traffic-aware via Google when configured,
  /// straight-line estimate otherwise).
  Future<Result<EtaInfo>> eta(String bookingId) async {
    try {
      final res = await _dio.get(TechnicianEndpoints.eta(bookingId));
      final m = (res.data is Map ? (res.data['data'] ?? res.data) : res.data) as Map<String, dynamic>;
      return Success(EtaInfo.fromJson(m));
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }

  /// Write-optimized ping (202). Best-effort: failures are swallowed by the caller.
  Future<Result<void>> ping({required String bookingId, required double lat, required double lng, DateTime? at}) async {
    try {
      await _dio.post(TechnicianEndpoints.location, data: {
        'booking_id': bookingId,
        'latitude': lat,
        'longitude': lng,
        'recorded_at': (at ?? DateTime.now()).toUtc().toIso8601String(),
      });
      return const Success(null);
    } catch (e) {
      return FailureResult(FailureMapper.map(e));
    }
  }
}

/// Parsed ETA result (backend shape: { distance_m, duration_s, eta, source }).
class EtaInfo {
  final int distanceMeters;
  final int durationSeconds;
  final DateTime? arrivalAt;
  final String source; // 'google' (traffic-aware) | 'estimate' (straight-line)

  const EtaInfo({
    required this.distanceMeters,
    required this.durationSeconds,
    this.arrivalAt,
    required this.source,
  });

  factory EtaInfo.fromJson(Map<String, dynamic> j) => EtaInfo(
        distanceMeters: int.tryParse((j['distance_m'] ?? 0).toString()) ?? 0,
        durationSeconds: int.tryParse((j['duration_s'] ?? 0).toString()) ?? 0,
        arrivalAt: j['eta'] == null ? null : DateTime.tryParse(j['eta'].toString()),
        source: (j['source'] ?? 'estimate').toString(),
      );

  String get durationLabel {
    final m = (durationSeconds / 60).round();
    if (m < 1) return 'Arriving now';
    if (m < 60) return '$m min';
    return '${m ~/ 60} h ${m % 60} min';
  }

  String get distanceLabel =>
      distanceMeters < 1000 ? '$distanceMeters m' : '${(distanceMeters / 1000).toStringAsFixed(1)} km';

  bool get isEstimate => source != 'google';
}
