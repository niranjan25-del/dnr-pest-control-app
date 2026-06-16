// lib/features/technician/jobs/job_workflow/report_builder_controller.dart
//
// Builds the service report locally (offline-capable): before/after photos, treatment
// notes, chemicals, and signature. On submit it uploads files → ids, then submits one
// report payload; if offline, it enqueues the report to the outbox (after uploading what
// it can) and reports success optimistically.

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failures.dart';
import '../../../../shared/state/submission_state.dart';
import '../../shared/application/technician_providers.dart';
import '../../shared/data/report_repository.dart';
import '../../shared/data/technician_repository.dart';
import '../../shared/models/technician_models.dart';
import '../../shared/offline/offline_outbox.dart';

class ReportDraft {
  final List<File> beforePhotos;
  final List<File> afterPhotos;
  final List<String> pestsFound;
  final List<String> areasTreated;
  final String? summary;
  final String? recommendations;
  final bool followUpRequired;
  final List<ChemicalEntry> chemicals;
  final Uint8List? signatureBytes;
  final String? signerName;

  const ReportDraft({
    this.beforePhotos = const [],
    this.afterPhotos = const [],
    this.pestsFound = const [],
    this.areasTreated = const [],
    this.summary,
    this.recommendations,
    this.followUpRequired = false,
    this.chemicals = const [],
    this.signatureBytes,
    this.signerName,
  });

  ReportDraft copyWith({
    List<File>? beforePhotos,
    List<File>? afterPhotos,
    List<String>? pestsFound,
    List<String>? areasTreated,
    String? summary,
    String? recommendations,
    bool? followUpRequired,
    List<ChemicalEntry>? chemicals,
    Uint8List? signatureBytes,
    String? signerName,
  }) =>
      ReportDraft(
        beforePhotos: beforePhotos ?? this.beforePhotos,
        afterPhotos: afterPhotos ?? this.afterPhotos,
        pestsFound: pestsFound ?? this.pestsFound,
        areasTreated: areasTreated ?? this.areasTreated,
        summary: summary ?? this.summary,
        recommendations: recommendations ?? this.recommendations,
        followUpRequired: followUpRequired ?? this.followUpRequired,
        chemicals: chemicals ?? this.chemicals,
        signatureBytes: signatureBytes ?? this.signatureBytes,
        signerName: signerName ?? this.signerName,
      );

  bool get hasSignature => signatureBytes != null && (signerName?.isNotEmpty ?? false);
}

class ReportBuilderState {
  final ReportDraft draft;
  final SubmissionState submission;
  const ReportBuilderState({this.draft = const ReportDraft(), this.submission = const SubmissionState.idle()});
  ReportBuilderState copyWith({ReportDraft? draft, SubmissionState? submission}) =>
      ReportBuilderState(draft: draft ?? this.draft, submission: submission ?? this.submission);
}

class ReportBuilderController extends StateNotifier<ReportBuilderState> {
  final Ref _ref;
  ReportBuilderController(this._ref) : super(const ReportBuilderState());

  void update(ReportDraft Function(ReportDraft) fn) => state = state.copyWith(draft: fn(state.draft));

  Future<bool> submit(String bookingId) async {
    state = state.copyWith(submission: const SubmissionState.submitting());
    final repo = _ref.read(reportRepositoryProvider);
    final d = state.draft;

    try {
      // 1) Upload photos + signature (best path; if any upload fails offline, fall to outbox).
      final beforeIds = <String>[];
      for (final f in d.beforePhotos) {
        final r = await repo.uploadPhoto(f, bookingId: bookingId, isBefore: true);
        r.when(success: beforeIds.add, failure: (f) => throw f);
      }
      final afterIds = <String>[];
      for (final f in d.afterPhotos) {
        final r = await repo.uploadPhoto(f, bookingId: bookingId, isBefore: false);
        r.when(success: afterIds.add, failure: (f) => throw f);
      }
      String? signatureId;
      if (d.signatureBytes != null) {
        final r = await repo.uploadSignature(d.signatureBytes!, bookingId: bookingId);
        signatureId = r.when(success: (id) => id, failure: (f) => throw f);
      }

      final payload = ReportPayload(
        bookingId: bookingId,
        pestsFound: d.pestsFound,
        areasTreated: d.areasTreated,
        summary: d.summary,
        recommendations: d.recommendations,
        followUpRequired: d.followUpRequired,
        chemicals: d.chemicals,
        signatureFileId: signatureId,
        signerName: d.signerName,
        photoFileIds: [...beforeIds, ...afterIds],
      );

      // 2) Submit; enqueue on network failure.
      final result = await repo.submitReport(payload);
      return await result.when(
        success: (_) async {
          state = state.copyWith(submission: const SubmissionState.success());
          return true;
        },
        failure: (f) async {
          if (f is NetworkFailure || f is TimeoutFailure) {
            await _enqueue(payload);
            state = state.copyWith(submission: const SubmissionState.success());
            return true;
          }
          state = state.copyWith(submission: SubmissionState.error(f));
          return false;
        },
      );
    } on Failure catch (f) {
      // An upload failed. If it's a network issue, queue the report submit (photos can be
      // re-uploaded on retry from the saved draft in a fuller impl); surface otherwise.
      if (f is NetworkFailure || f is TimeoutFailure) {
        await _enqueue(ReportPayload(
          bookingId: bookingId,
          pestsFound: d.pestsFound,
          areasTreated: d.areasTreated,
          summary: d.summary,
          recommendations: d.recommendations,
          followUpRequired: d.followUpRequired,
          chemicals: d.chemicals,
          signerName: d.signerName,
        ));
        state = state.copyWith(submission: const SubmissionState.success());
        return true;
      }
      state = state.copyWith(submission: SubmissionState.error(f));
      return false;
    }
  }

  Future<void> _enqueue(ReportPayload payload) async {
    await _ref.read(offlineOutboxProvider).enqueue(OutboxAction(
          id: 'report-${payload.bookingId}-${DateTime.now().millisecondsSinceEpoch}',
          kind: OutboxKind.reportSubmit,
          path: TechnicianEndpoints.report(payload.bookingId),
          body: payload.toBody(),
        ));
    _ref.invalidate(pendingSyncCountProvider);
  }
}

final reportBuilderControllerProvider =
    StateNotifierProvider.autoDispose<ReportBuilderController, ReportBuilderState>((ref) => ReportBuilderController(ref));
