// lib/features/technician/reports/report_history_screen.dart
//
// Completed jobs as a lightweight report history; tap to download the PDF (deep-link to the
// service-report download endpoint when wired). Reuses ReportRepository.reportHistory().

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/result.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

final reportHistoryProvider = FutureProvider.autoDispose<List<Job>>((ref) async {
  final r = await ref.watch(reportRepositoryProvider).reportHistory();
  return r.when(success: (d) => d, failure: (f) => throw f);
});

class ReportHistoryScreen extends ConsumerWidget {
  const ReportHistoryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(reportHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My reports')),
      body: AsyncValueView<List<Job>>(
        value: history,
        onRetry: () => ref.invalidate(reportHistoryProvider),
        isEmpty: (d) => d.isEmpty,
        empty: const EmptyView(icon: Icons.description_outlined, title: 'No submitted reports yet'),
        data: (jobs) => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: jobs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final j = jobs[i];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(j.serviceName ?? 'Service'),
                subtitle: Text([if (j.windowStart != null) DateFormat.yMMMd().format(j.windowStart!), j.customerName ?? ''].where((s) => s.isNotEmpty).join('  •  ')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/technician/jobs/${j.id}'),
              ),
            );
          },
        ),
      ),
    );
  }
}
