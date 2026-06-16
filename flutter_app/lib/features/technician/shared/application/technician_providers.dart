// lib/features/technician/shared/application/technician_providers.dart
//
// Technician DI graph + read providers + the offline outbox and a connectivity-driven
// flush. Jobs are fetched once and partitioned (today/upcoming/completed) client-side.

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/result.dart';
import '../../../../providers/core_providers.dart';
import '../data/report_repository.dart';
import '../data/technician_repository.dart';
import '../models/technician_models.dart';
import '../offline/offline_outbox.dart';

T _orThrow<T>(Result<T> r) => r.when(success: (d) => d, failure: (f) => throw f);

final technicianRepositoryProvider = Provider((ref) => TechnicianRepository(ref.watch(dioProvider)));
final reportRepositoryProvider = Provider((ref) => ReportRepository(ref.watch(dioProvider)));
final locationRepositoryProvider = Provider((ref) => LocationRepository(ref.watch(dioProvider)));
final offlineOutboxProvider = Provider((ref) => OfflineOutbox());

// ---- Reads ----
final technicianProfileProvider = FutureProvider.autoDispose<TechnicianProfile>((ref) async {
  return _orThrow(await ref.watch(technicianRepositoryProvider).profile());
});

final jobsProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  return _orThrow(await ref.watch(technicianRepositoryProvider).jobs());
});

final todayJobsProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  final jobs = await ref.watch(jobsProvider.future);
  return jobs.where((j) => j.isToday).toList();
});

/// Live ETA to a job site. autoDispose so it re-fetches when the navigation screen reopens;
/// callers can `ref.invalidate(etaProvider(id))` to refresh on demand.
final etaProvider = FutureProvider.autoDispose.family<EtaInfo, String>((ref, bookingId) async {
  return _orThrow(await ref.watch(locationRepositoryProvider).eta(bookingId));
});

final jobByIdProvider = FutureProvider.autoDispose.family<Job, String>((ref, id) async {
  final jobs = await ref.watch(jobsProvider.future);
  return jobs.firstWhere((j) => j.id == id, orElse: () => throw StateError('Job not found'));
});

final pendingSyncCountProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(offlineOutboxProvider).pendingCount;
});

/// Watches connectivity and flushes the outbox whenever the device comes back online.
/// Keep alive by reading it once at the shell.
final outboxSyncProvider = Provider<void>((ref) {
  final outbox = ref.watch(offlineOutboxProvider);
  final dio = ref.watch(dioProvider);
  final sub = Connectivity().onConnectivityChanged.listen((results) async {
    final online = results.any((r) => r != ConnectivityResult.none);
    if (online) {
      await outbox.flush(dio);
      ref.invalidate(jobsProvider);
      ref.invalidate(pendingSyncCountProvider);
    }
  });
  ref.onDispose(sub.cancel);
  // Attempt an initial flush on startup.
  outbox.flush(dio);
});
