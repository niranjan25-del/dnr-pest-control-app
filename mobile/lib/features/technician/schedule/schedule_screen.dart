// lib/features/technician/schedule/schedule_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

// ── selected day provider ────────────────────────────────────────────────────

final _selectedDayProvider = StateProvider.autoDispose<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

// ── status color ─────────────────────────────────────────────────────────────

Color _jobColor(BuildContext ctx, JobStatus s) => switch (s) {
  JobStatus.confirmed   => Theme.of(ctx).colorScheme.primary,
  JobStatus.enRoute     => Colors.blue,
  JobStatus.arrived     => Colors.orange,
  JobStatus.inProgress  => Colors.deepPurple,
  JobStatus.completed   => Colors.green,
  _                     => Theme.of(ctx).colorScheme.outlineVariant,
};

// ── main screen ──────────────────────────────────────────────────────────────

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(jobsProvider);
    final selectedDay = ref.watch(_selectedDayProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: false,
        elevation: 0,
      ),
      body: AsyncValueView<List<Job>>(
        value: jobs,
        onRetry: () => ref.invalidate(jobsProvider),
        data: (all) {
          final scheduled = all.where((j) => j.windowStart != null).toList()
            ..sort((a, b) => a.windowStart!.compareTo(b.windowStart!));

          final now = DateTime.now();
          final week = List.generate(14, (i) => DateTime(now.year, now.month, now.day).add(Duration(days: i - 1)));

          return Column(
            children: [
              // ── Horizontal day picker ──
              _DayPicker(days: week, jobs: scheduled, selected: selectedDay, onSelect: (d) => ref.read(_selectedDayProvider.notifier).state = d),

              // ── Day divider ──
              Container(
                width: double.infinity,
                color: Theme.of(context).colorScheme.surfaceContainerLow,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Text(
                  _dayLabel(selectedDay),
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Theme.of(context).colorScheme.onSurface),
                ),
              ),
              const Divider(height: 1),

              // ── Timeline ──
              Expanded(child: _TimelineView(jobs: scheduled, day: selectedDay)),
            ],
          );
        },
      ),
    );
  }

  String _dayLabel(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    if (d == today) return 'Today · ${DateFormat('d MMM').format(d)}';
    if (d == tomorrow) return 'Tomorrow · ${DateFormat('d MMM').format(d)}';
    return DateFormat('EEEE · d MMMM').format(d);
  }
}

// ── day picker ───────────────────────────────────────────────────────────────

class _DayPicker extends StatelessWidget {
  final List<DateTime> days;
  final List<Job> jobs;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;
  const _DayPicker({required this.days, required this.jobs, required this.selected, required this.onSelect});

  bool _hasJob(DateTime day) => jobs.any((j) {
    final s = j.windowStart!;
    return s.year == day.year && s.month == day.month && s.day == day.day;
  });

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Container(
      color: cs.surface,
      height: 88,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        itemCount: days.length,
        itemBuilder: (_, i) {
          final day      = days[i];
          final isToday  = day == today;
          final isSel    = day == selected;
          final hasJob   = _hasJob(day);
          final bgColor  = isSel ? cs.primary : isToday ? cs.primaryContainer : Colors.transparent;
          final txtColor = isSel ? cs.onPrimary : isToday ? cs.onPrimaryContainer : cs.onSurface;

          return GestureDetector(
            onTap: () => onSelect(day),
            child: Container(
              width: 52,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(14),
                border: isSel ? null : Border.all(color: cs.outlineVariant),
              ),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(DateFormat('E').format(day)[0], style: TextStyle(fontSize: 11, color: txtColor.withOpacity(0.7), fontWeight: FontWeight.w500)),
                const SizedBox(height: 4),
                Text('${day.day}', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: txtColor)),
                const SizedBox(height: 4),
                Container(
                  width: 5, height: 5,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: hasJob ? (isSel ? cs.onPrimary.withOpacity(0.7) : cs.primary) : Colors.transparent,
                  ),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }
}

// ── timeline ─────────────────────────────────────────────────────────────────

class _TimelineView extends StatelessWidget {
  final List<Job> jobs;
  final DateTime day;
  const _TimelineView({required this.jobs, required this.day});

  @override
  Widget build(BuildContext context) {
    final dayJobs = jobs.where((j) {
      final s = j.windowStart!;
      return s.year == day.year && s.month == day.month && s.day == day.day;
    }).toList();

    if (dayJobs.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.event_available_outlined, size: 56, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 12),
          Text('No jobs scheduled', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 16)),
          const SizedBox(height: 4),
          Text('Select another day to see your schedule', style: TextStyle(color: Theme.of(context).colorScheme.outline, fontSize: 13)),
        ]),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
      itemCount: dayJobs.length,
      itemBuilder: (_, i) => _TimelineEntry(job: dayJobs[i], isLast: i == dayJobs.length - 1),
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  final Job job;
  final bool isLast;
  const _TimelineEntry({required this.job, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final color = _jobColor(context, job.status);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Time column ──
          SizedBox(
            width: 56,
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(DateFormat('HH:mm').format(job.windowStart!), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
              if (job.windowEnd != null)
                Text(DateFormat('HH:mm').format(job.windowEnd!), style: TextStyle(fontSize: 11, color: cs.outline)),
            ]),
          ),

          const SizedBox(width: 12),

          // ── Timeline line + dot ──
          Column(children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: color, border: Border.all(color: cs.surface, width: 2))),
            if (!isLast) Expanded(child: Container(width: 2, color: cs.outlineVariant)),
          ]),

          const SizedBox(width: 12),

          // ── Job card ──
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: cs.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: cs.outlineVariant),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))],
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => context.push('/technician/jobs/${job.id}'),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(job.serviceName ?? 'Service', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text(job.status.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                    ),
                  ]),
                  if (job.customerName != null) ...[
                    const SizedBox(height: 4),
                    Text(job.customerName!, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
                  ],
                  if (job.addressLine != null) ...[
                    const SizedBox(height: 2),
                    Text(job.addressLine!, style: TextStyle(fontSize: 12, color: cs.outline), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── async helper ─────────────────────────────────────────────────────────────

class AsyncValueView<T> extends ConsumerWidget {
  final AsyncValue<T> value;
  final Widget Function(T) data;
  final VoidCallback onRetry;
  const AsyncValueView({super.key, required this.value, required this.data, required this.onRetry});

  @override
  Widget build(BuildContext context, WidgetRef ref) => value.when(
    loading: () => const Center(child: CircularProgressIndicator()),
    error:   (e, _) => ErrorView(message: e.toString(), onRetry: onRetry),
    data:    data,
  );
}