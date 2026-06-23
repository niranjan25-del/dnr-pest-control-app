// lib/features/technician/jobs/job_screens.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

// ── filter chip bar ──────────────────────────────────────────────────────────

const _filters = [
  ('ALL', 'All jobs', null),
  ('NEW', 'New', Colors.orange),
  ('ACTIVE', 'Active', Colors.blue),
  ('COMPLETED', 'Completed', Colors.green),
];

final _jobFilterProvider = StateProvider.autoDispose<String>((ref) => 'ALL');

// ── status color map ─────────────────────────────────────────────────────────

Color _statusColor(BuildContext ctx, JobStatus s) {
  return switch (s) {
    JobStatus.confirmed   => Theme.of(ctx).colorScheme.primary,
    JobStatus.enRoute     => Colors.blue,
    JobStatus.arrived     => Colors.orange,
    JobStatus.inProgress  => Colors.deepPurple,
    JobStatus.completed   => Colors.green,
    _                     => Theme.of(ctx).colorScheme.outlineVariant,
  };
}

// ── job list screen ──────────────────────────────────────────────────────────

class JobListScreen extends ConsumerWidget {
  const JobListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs   = ref.watch(jobsProvider);
    final filter = ref.watch(_jobFilterProvider);
    final cs     = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        title: const Text('My jobs', style: TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: Column(
        children: [
          // Filter chips
          Container(
            color: cs.surface,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                spacing: 8,
                children: _filters.map((f) {
                  final (key, label, color) = f;
                  final selected = filter == key;
                  return FilterChip(
                    label: Text(label),
                    selected: selected,
                    onSelected: (_) => ref.read(_jobFilterProvider.notifier).state = key,
                    selectedColor: (color ?? cs.primary).withOpacity(0.15),
                    checkmarkColor: color ?? cs.primary,
                    labelStyle: TextStyle(
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      color: selected ? (color ?? cs.primary) : cs.onSurfaceVariant,
                    ),
                    side: BorderSide(color: selected ? (color ?? cs.primary).withOpacity(0.4) : cs.outlineVariant),
                    backgroundColor: cs.surfaceContainerLow,
                  );
                }).toList(),
              ),
            ),
          ),

          Expanded(
            child: AsyncValueView<List<Job>>(
              value: jobs,
              onRetry: () => ref.invalidate(jobsProvider),
              data: (all) {
                final items = all.where((j) => switch (filter) {
                  'NEW'       => j.needsAcceptance,
                  'ACTIVE'    => j.isActive && !j.needsAcceptance,
                  'COMPLETED' => j.status == JobStatus.completed,
                  _           => true,
                }).toList();

                if (items.isEmpty) {
                  return Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.work_off_outlined, size: 56, color: cs.outline),
                      const SizedBox(height: 12),
                      Text('No ${filter == 'ALL' ? '' : filter.toLowerCase() + ' '}jobs', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 16)),
                    ]),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(jobsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                    itemCount: items.length,
                    itemBuilder: (_, i) => _JobListCard(items[i]),
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

class _JobListCard extends StatelessWidget {
  final Job job;
  const _JobListCard(this.job);

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final color = _statusColor(context, job.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/technician/jobs/${job.id}'),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left color bar
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: const BorderRadius.only(topLeft: Radius.circular(16), bottomLeft: Radius.circular(16)),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Text(job.serviceName ?? 'Service', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      _StatusPill(job.status, color: color),
                    ]),
                    const SizedBox(height: 6),
                    if (job.customerName != null)
                      _InfoLine(Icons.person_outline, job.customerName!),
                    if (job.addressLine != null)
                      _InfoLine(Icons.location_on_outlined, job.addressLine!),
                    if (job.windowStart != null) ...[
                      const SizedBox(height: 4),
                      Row(children: [
                        Icon(Icons.schedule, size: 14, color: color),
                        const SizedBox(width: 6),
                        Text(
                          DateFormat('EEE d MMM · HH:mm').format(job.windowStart!),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
                        ),
                      ]),
                    ],
                    if (job.needsAcceptance) ...[
                      const SizedBox(height: 10),
                      Row(children: [
                        _AcceptDeclineBar(job),
                      ]),
                    ],
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoLine(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 3),
    child: Row(children: [
      Icon(icon, size: 14, color: Theme.of(context).colorScheme.outline),
      const SizedBox(width: 6),
      Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]),
  );
}

class _StatusPill extends StatelessWidget {
  final JobStatus status;
  final Color color;
  const _StatusPill(this.status, {required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
    child: Text(status.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
  );
}

class _AcceptDeclineBar extends ConsumerWidget {
  final Job job;
  const _AcceptDeclineBar(this.job);
  @override
  Widget build(BuildContext context, WidgetRef ref) => Expanded(
    child: Row(children: [
      Expanded(
        child: OutlinedButton(
          onPressed: () => context.push('/technician/jobs/${job.id}/workflow'),
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 8)),
          child: const Text('Decline'),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: FilledButton(
          onPressed: () => context.push('/technician/jobs/${job.id}/workflow'),
          style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 8)),
          child: const Text('Accept'),
        ),
      ),
    ]),
  );
}

// ── job details screen ───────────────────────────────────────────────────────

class JobDetailsScreen extends ConsumerWidget {
  final String bookingId;
  const JobDetailsScreen({super.key, required this.bookingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(jobByIdProvider(bookingId));
    final cs  = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      body: job.when(
        loading: () => const LoadingView(),
        error:   (e, _) => ErrorView(message: 'Could not load job', onRetry: () => ref.invalidate(jobsProvider)),
        data:    (j) => _JobDetailContent(j),
      ),
    );
  }
}

class _JobDetailContent extends StatelessWidget {
  final Job j;
  const _JobDetailContent(this.j);

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final color = _statusColor(context, j.status);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 130,
          backgroundColor: color,
          foregroundColor: Colors.white,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
                  colors: [color, Color.lerp(color, Colors.black, 0.3)!]),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 48, 20, 14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                      child: Text(j.status.label.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                    ),
                    const SizedBox(height: 6),
                    Text(j.serviceName ?? 'Service Job', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Details card
              _DetailCard(children: [
                _DetailRow(Icons.person_outline, 'Customer', j.customerName ?? '—'),
                if (j.customerPhone != null) _DetailRow(Icons.phone_outlined, 'Phone', j.customerPhone!),
                _DetailRow(Icons.location_on_outlined, 'Address', j.addressLine ?? '—'),
                if (j.windowStart != null) _DetailRow(Icons.schedule, 'Window', DateFormat('EEE d MMM · HH:mm').format(j.windowStart!)),
                if (j.gateCode != null) _DetailRow(Icons.vpn_key_outlined, 'Gate code', j.gateCode!),
                if (j.accessNotes != null) _DetailRow(Icons.sticky_note_2_outlined, 'Access notes', j.accessNotes!),
              ]),

              const SizedBox(height: 12),

              // Target pests
              if (j.targetPests.isNotEmpty) ...[
                Text('Target pests', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: cs.onSurfaceVariant)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: j.targetPests.map((p) => Chip(label: Text(p), size: MaterialTapTargetSize.shrinkWrap)).toList()),
                const SizedBox(height: 16),
              ],

              // Actions
              if (j.latitude != null && j.longitude != null)
                OutlinedButton.icon(
                  onPressed: () => context.push('/technician/jobs/${j.id}/navigate'),
                  icon: const Icon(Icons.navigation_outlined),
                  label: const Text('Navigate to site'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: () => context.push('/technician/jobs/${j.id}/workflow'),
                icon: const Icon(Icons.play_arrow_rounded),
                label: Text(j.needsAcceptance ? 'Review & accept' : 'Open job workflow'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: color,
                ),
              ),
              const SizedBox(height: 40),
            ]),
          ),
        ),
      ],
    );
  }
}

class _DetailCard extends StatelessWidget {
  final List<Widget> children;
  const _DetailCard({required this.children});
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Column(children: children.map((c) => c).toList()),
  );
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _DetailRow(this.icon, this.label, this.value);
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: cs.primary),
        const SizedBox(width: 14),
        SizedBox(width: 88, child: Text(label, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
      ]),
    );
  }
}