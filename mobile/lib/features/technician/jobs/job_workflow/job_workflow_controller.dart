// lib/features/technician/jobs/job_workflow/job_workflow_controller.dart
//
// Drives a job through its status transitions (accept → en route → arrived → in progress →
// completed), starting/stopping location tracking at the right points, and enqueuing to the
// offline outbox when the network is down (optimistic success). Status transitions are
// idempotent on the server side; the outbox replays them in order when back online.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/result.dart';
import '../../../../shared/state/submission_state.dart';
import '../../shared/application/location_tracking_service.dart';
import '../../shared/application/technician_providers.dart';
import '../../shared/data/technician_repository.dart';
import '../../shared/models/technician_models.dart';
import '../../shared/offline/offline_outbox.dart';

class JobWorkflowController extends StateNotifier<SubmissionState> {
  final Ref _ref;
  JobWorkflowController(this._ref) : super(const SubmissionState.idle());

  Future<bool> accept(String bookingId) => _run(() => _ref.read(technicianRepositoryProvider).accept(bookingId));
  Future<bool> decline(String bookingId, {String? reason}) =>
      _run(() => _ref.read(technicianRepositoryProvider).decline(bookingId, reason: reason));

  /// Transition status; starts/stops GPS tracking around the job lifecycle.
  Future<bool> transition({required String bookingId, required JobStatus to, String? note}) async {
    state = const SubmissionState.submitting();
    final tracker = _ref.read(locationTrackingServiceProvider);

    final result = await _ref.read(technicianRepositoryProvider).updateStatus(bookingId: bookingId, status: to.apiValue, note: note);

    final ok = await result.when(
      success: (_) async => true,
      failure: (f) async {
        // Offline → enqueue and proceed optimistically; otherwise surface the error.
        if (f is NetworkFailure || f is TimeoutFailure) {
          await _ref.read(offlineOutboxProvider).enqueue(OutboxAction(
                id: 'status-$bookingId-${to.apiValue}-${DateTime.now().millisecondsSinceEpoch}',
                kind: OutboxKind.statusUpdate,
                path: TechnicianEndpoints.status(bookingId),
                body: {'status': to.apiValue, if (note != null) 'note': note},
              ));
          _ref.invalidate(pendingSyncCountProvider);
          return true;
        }
        state = SubmissionState.error(f);
        return false;
      },
    );

    if (!ok) return false;

    // Side effects: tracking lifecycle.
    if (to == JobStatus.enRoute) {
      await tracker.start(bookingId);
    } else if (to == JobStatus.completed) {
      await tracker.stop();
    }

    _ref.invalidate(jobsProvider);
    state = const SubmissionState.success();
    return true;
  }

  Future<bool> _run(Future<Result<void>> Function() action) async {
    state = const SubmissionState.submitting();
    final r = await action();
    return r.when(
      success: (_) {
        _ref.invalidate(jobsProvider);
        state = const SubmissionState.success();
        return true;
      },
      failure: (f) {
        state = SubmissionState.error(f);
        return false;
      },
    );
  }
}

final jobWorkflowControllerProvider =
    StateNotifierProvider.autoDispose<JobWorkflowController, SubmissionState>((ref) => JobWorkflowController(ref));
