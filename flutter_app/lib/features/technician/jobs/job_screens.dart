// lib/features/technician/jobs/job_screens.dart
//
// Assigned job list with status filters, and the job details screen (entry point into the
// workflow + map navigation). Grouped because they share models/providers.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

final _jobFilterProvider = StateProvider.autoDispose<String>((ref) => 'ALL');

class JobListScreen extends ConsumerWidget {
  const JobListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(jobsProvider);
    final filter = ref.watch(_jobFilterProvider);
    const filters = ['ALL', 'NEW', 'ACTIVE', 'COMPLETED'];

    return Scaffold(
      appBar: AppBar(title: const Text('My jobs')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: filters
                  .map((f) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f[0] + f.substring(1).toLowerCase()),
                          selected: filter == f,
                          onSelected: (_) => ref.read(_jobFilterProvider.notifier).state = f,
                        ),
                      ))
                  .toList(),
            ),
          ),
          Expanded(
            child: AsyncValueView<List<Job>>(
              value: jobs,
              onRetry: () => ref.invalidate(jobsProvider),
              data: (all) {
                final items = all.where((j) {
                  switch (filter) {
                    case 'NEW':
                      return j.needsAcceptance;
                    case 'ACTIVE':
                      return j.isActive && !j.needsAcceptance;
                    case 'COMPLETED':
                      return j.status == JobStatus.completed;
                    default:
                      return true;
                  }
                }).toList();
                if (items.isEmpty) return const EmptyView(icon: Icons.work_off_outlined, title: 'No jobs here');
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(jobsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final j = items[i];
                      return Card(
                        child: ListTile(
                          leading: const Icon(Icons.work_outline),
                          title: Text(j.serviceName ?? 'Service'),
                          subtitle: Text([if (j.windowStart != null) '${j.windowStart}'.split('.').first, j.addressLine ?? '', j.status.label].where((s) => s.isNotEmpty).join('  •  ')),
                          trailing: j.needsAcceptance ? const Chip(label: Text('New')) : const Icon(Icons.chevron_right),
                          onTap: () => context.push('/technician/jobs/${j.id}'),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class JobDetailsScreen extends ConsumerWidget {
  final String bookingId;
  const JobDetailsScreen({super.key, required this.bookingId});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(jobByIdProvider(bookingId));
    return Scaffold(
      appBar: AppBar(title: const Text('Job details')),
      body: job.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load job', onRetry: () => ref.invalidate(jobsProvider)),
        data: (j) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Chip(label: Text(j.status.label)),
            const SizedBox(height: 12),
            _detail(context, Icons.pest_control_outlined, 'Service', j.serviceName ?? '—'),
            _detail(context, Icons.person_outline, 'Customer', j.customerName ?? '—'),
            if (j.customerPhone != null) _detail(context, Icons.phone_outlined, 'Phone', j.customerPhone!),
            _detail(context, Icons.location_on_outlined, 'Address', j.addressLine ?? '—'),
            if (j.windowStart != null) _detail(context, Icons.schedule, 'Window', '${j.windowStart}'.split('.').first),
            if (j.gateCode != null) _detail(context, Icons.vpn_key_outlined, 'Gate code', j.gateCode!),
            if (j.accessNotes != null) _detail(context, Icons.sticky_note_2_outlined, 'Access notes', j.accessNotes!),
            const SizedBox(height: 20),
            if (j.latitude != null && j.longitude != null)
              OutlinedButton.icon(
                onPressed: () => context.push('/technician/jobs/${j.id}/navigate'),
                icon: const Icon(Icons.navigation_outlined),
                label: const Text('Navigate'),
              ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () => context.push('/technician/jobs/${j.id}/workflow'),
              icon: const Icon(Icons.play_arrow),
              label: Text(j.needsAcceptance ? 'Review & accept' : 'Open workflow'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detail(BuildContext context, IconData icon, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 20, color: context.colors.primary),
          const SizedBox(width: 12),
          SizedBox(width: 96, child: Text(k, style: context.text.labelMedium)),
          Expanded(child: Text(v, style: context.text.bodyMedium)),
        ]),
      );
}
