// lib/features/technician/schedule/schedule_screen.dart
//
// Daily list + a simple weekly overview built from the assigned jobs, plus the availability
// toggle. Jobs are grouped by day; tap-through opens the job.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(jobsProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Schedule'),
          bottom: const TabBar(tabs: [Tab(text: 'Day'), Tab(text: 'Week')]),
        ),
        body: AsyncValueView<List<Job>>(
          value: jobs,
          onRetry: () => ref.invalidate(jobsProvider),
          data: (all) {
            final scheduled = all.where((j) => j.windowStart != null).toList()..sort((a, b) => a.windowStart!.compareTo(b.windowStart!));
            return TabBarView(children: [_DayView(scheduled), _WeekView(scheduled)]);
          },
        ),
      ),
    );
  }
}

class _DayView extends StatelessWidget {
  final List<Job> jobs;
  const _DayView(this.jobs);
  @override
  Widget build(BuildContext context) {
    final today = jobs.where((j) => j.isToday).toList();
    if (today.isEmpty) return const EmptyView(icon: Icons.event_available_outlined, title: 'No jobs today');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: today
          .map((j) => Card(
                child: ListTile(
                  leading: Text(DateFormat.jm().format(j.windowStart!), style: context.text.labelLarge),
                  title: Text(j.serviceName ?? 'Service'),
                  subtitle: Text(j.addressLine ?? ''),
                  onTap: () => context.push('/technician/jobs/${j.id}'),
                ),
              ))
          .toList(),
    );
  }
}

class _WeekView extends StatelessWidget {
  final List<Job> jobs;
  const _WeekView(this.jobs);
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final byDay = <DateTime, List<Job>>{};
    for (var i = 0; i < 7; i++) {
      final day = DateTime(now.year, now.month, now.day).add(Duration(days: i));
      byDay[day] = jobs.where((j) => j.windowStart != null && j.windowStart!.year == day.year && j.windowStart!.month == day.month && j.windowStart!.day == day.day).toList();
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: byDay.entries.map((e) {
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(DateFormat.EEEE().add_MMMd().format(e.key), style: context.text.titleSmall)),
          if (e.value.isEmpty)
            Text('—', style: context.text.bodySmall)
          else
            ...e.value.map((j) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Text(DateFormat.jm().format(j.windowStart!)),
                  title: Text(j.serviceName ?? 'Service'),
                  onTap: () => context.push('/technician/jobs/${j.id}'),
                )),
          const Divider(),
        ]);
      }).toList(),
    );
  }
}
