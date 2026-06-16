// lib/features/technician/dashboard/dashboard_screen.dart
//
// Technician home: availability toggle, today's jobs, upcoming, a completed-summary count,
// notifications entry, and a simple performance overview. A pending-sync chip surfaces any
// queued offline actions.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/data/notifications_repository.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

class TechnicianDashboardScreen extends ConsumerWidget {
  const TechnicianDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(jobsProvider);
    final profile = ref.watch(technicianProfileProvider);
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;
    final pending = ref.watch(pendingSyncCountProvider).valueOrNull ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My day'),
        actions: [
          IconButton(
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
            onPressed: () => context.push('/technician/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(jobsProvider);
          ref.invalidate(unreadNotificationsCountProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (pending > 0)
              Card(
                color: context.colors.tertiaryContainer,
                child: ListTile(
                  leading: const Icon(Icons.sync_problem),
                  title: Text('$pending change(s) waiting to sync'),
                  subtitle: const Text('They’ll upload automatically when you’re back online.'),
                ),
              ),
            profile.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (p) => _AvailabilityCard(available: p.isAvailable),
            ),
            const SizedBox(height: 16),
            AsyncValueView<List<Job>>(
              value: jobs,
              onRetry: () => ref.invalidate(jobsProvider),
              data: (all) {
                final today = all.where((j) => j.isToday).toList();
                final upcoming = all.where((j) => !j.isToday && j.isActive).toList();
                final completed = all.where((j) => j.status == JobStatus.completed).length;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _PerfRow(todayCount: today.length, upcoming: upcoming.length, completed: completed),
                    const SizedBox(height: 20),
                    Text("Today's jobs", style: context.text.titleMedium),
                    const SizedBox(height: 8),
                    if (today.isEmpty)
                      const EmptyView(icon: Icons.event_available_outlined, title: 'No jobs today')
                    else
                      ...today.map((j) => _JobTile(j)),
                    const SizedBox(height: 20),
                    Text('Upcoming', style: context.text.titleMedium),
                    const SizedBox(height: 8),
                    if (upcoming.isEmpty)
                      const EmptyView(icon: Icons.upcoming_outlined, title: 'Nothing upcoming')
                    else
                      ...upcoming.map((j) => _JobTile(j)),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AvailabilityCard extends ConsumerStatefulWidget {
  final bool available;
  const _AvailabilityCard({required this.available});
  @override
  ConsumerState<_AvailabilityCard> createState() => _AvailabilityCardState();
}

class _AvailabilityCardState extends ConsumerState<_AvailabilityCard> {
  late bool _value = widget.available;
  bool _busy = false;

  Future<void> _toggle(bool v) async {
    setState(() {
      _value = v;
      _busy = true;
    });
    final res = await ref.read(technicianRepositoryProvider).setAvailability(v);
    if (!mounted) return;
    res.when(
      success: (_) => ref.invalidate(technicianProfileProvider),
      failure: (f) {
        setState(() => _value = !v);
        context.showSnack(f.message);
      },
    );
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => Card(
        child: SwitchListTile(
          value: _value,
          onChanged: _busy ? null : _toggle,
          title: const Text('Available for jobs'),
          subtitle: Text(_value ? 'You can receive assignments' : 'You won’t be assigned new jobs'),
          secondary: Icon(_value ? Icons.check_circle : Icons.pause_circle_outline),
        ),
      );
}

class _PerfRow extends StatelessWidget {
  final int todayCount;
  final int upcoming;
  final int completed;
  const _PerfRow({required this.todayCount, required this.upcoming, required this.completed});
  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value, IconData icon) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [Icon(icon, color: context.colors.primary), const SizedBox(height: 8), Text(value, style: context.text.headlineSmall), Text(label, style: context.text.bodySmall)]),
            ),
          ),
        );
    return Row(children: [
      stat('Today', '$todayCount', Icons.today),
      const SizedBox(width: 8),
      stat('Upcoming', '$upcoming', Icons.upcoming),
      const SizedBox(width: 8),
      stat('Completed', '$completed', Icons.task_alt),
    ]);
  }
}

class _JobTile extends StatelessWidget {
  final Job job;
  const _JobTile(this.job);
  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: const Icon(Icons.work_outline),
          title: Text(job.serviceName ?? 'Service'),
          subtitle: Text([if (job.windowStart != null) '${job.windowStart}'.split('.').first, job.addressLine ?? '', job.status.label].where((s) => s.isNotEmpty).join('  •  ')),
          trailing: job.needsAcceptance ? const Chip(label: Text('New')) : null,
          onTap: () => context.push('/technician/jobs/${job.id}'),
        ),
      );
}
