// lib/features/technician/dashboard/dashboard_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../shared/data/notifications_repository.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

// ── status helpers ──────────────────────────────────────────────────────────

Color _statusColor(BuildContext ctx, JobStatus s) {
  final cs = Theme.of(ctx).colorScheme;
  return switch (s) {
    JobStatus.confirmed => cs.primary,
    JobStatus.enRoute   => Colors.blue,
    JobStatus.arrived   => Colors.orange,
    JobStatus.inProgress => Colors.deepPurple,
    JobStatus.completed => Colors.green,
    _                   => cs.outlineVariant,
  };
}

// ── main screen ─────────────────────────────────────────────────────────────

class TechnicianDashboardScreen extends ConsumerWidget {
  const TechnicianDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs    = ref.watch(jobsProvider);
    final profile = ref.watch(technicianProfileProvider);
    final unread  = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;
    final pending = ref.watch(pendingSyncCountProvider).valueOrNull ?? 0;
    final cs      = Theme.of(context).colorScheme;
    final now     = DateTime.now();
    final greeting = now.hour < 12 ? 'Good morning' : now.hour < 17 ? 'Good afternoon' : 'Good evening';

    return Scaffold(
      backgroundColor: cs.surface,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(jobsProvider);
          ref.invalidate(technicianProfileProvider);
          ref.invalidate(unreadNotificationsCountProvider);
        },
        child: CustomScrollView(
          slivers: [
            // ── Hero header ──
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: cs.primary,
              foregroundColor: Colors.white,
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [cs.primary, Color.lerp(cs.primary, Colors.black, 0.35)!],
                        ),
                      ),
                    ),
                    // decorative circle
                    Positioned(right: -40, top: -40,
                      child: Container(width: 200, height: 200, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.06)))),
                    Positioned(right: 60, bottom: -30,
                      child: Container(width: 120, height: 120, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.04)))),
                    // content
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            profile.when(
                              loading: () => const SizedBox.shrink(),
                              error: (_, __) => const SizedBox.shrink(),
                              data: (p) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(greeting, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                                Text(p.fullName, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                              ]),
                            ),
                            const SizedBox(height: 6),
                            Text(DateFormat('EEEE, d MMMM yyyy').format(now), style: const TextStyle(color: Colors.white60, fontSize: 13)),
                            const SizedBox(height: 14),
                            // Availability toggle inline
                            profile.maybeWhen(
                              data: (p) => _CompactAvailability(available: p.isAvailable, ref: ref),
                              orElse: () => const SizedBox.shrink(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                IconButton(
                  icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined, color: Colors.white)),
                  onPressed: () => context.push('/technician/notifications'),
                ),
                const SizedBox(width: 4),
              ],
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // ── Offline sync banner ──
                  if (pending > 0)
                    _SyncBanner(count: pending),

                  // ── Job stats row ──
                  AsyncValueWidget<List<Job>>(
                    value: jobs,
                    onRetry: () => ref.invalidate(jobsProvider),
                    data: (all) {
                      final today     = all.where((j) => j.isToday).toList();
                      final upcoming  = all.where((j) => !j.isToday && j.isActive).toList();
                      final completed = all.where((j) => j.status == JobStatus.completed).length;
                      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _StatsRow(today: today.length, upcoming: upcoming.length, completed: completed),
                        const SizedBox(height: 24),
                        _SectionHeader(title: "Today's jobs", count: today.length),
                        const SizedBox(height: 10),
                        if (today.isEmpty)
                          _EmptyCard(icon: Icons.event_available_outlined, message: "You're free today!")
                        else
                          ...today.map((j) => _JobCard(j)),
                        const SizedBox(height: 24),
                        _SectionHeader(title: 'Upcoming', count: upcoming.length),
                        const SizedBox(height: 10),
                        if (upcoming.isEmpty)
                          _EmptyCard(icon: Icons.upcoming_outlined, message: 'No upcoming jobs scheduled')
                        else
                          ...upcoming.map((j) => _JobCard(j)),
                        const SizedBox(height: 80),
                      ]);
                    },
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── sub-widgets ──────────────────────────────────────────────────────────────

class AsyncValueWidget<T> extends ConsumerWidget {
  final AsyncValue<T> value;
  final Widget Function(T) data;
  final VoidCallback onRetry;
  const AsyncValueWidget({super.key, required this.value, required this.data, required this.onRetry});

  @override
  Widget build(BuildContext context, WidgetRef ref) => value.when(
    loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
    error: (e, _) => ErrorView(message: e.toString(), onRetry: onRetry),
    data: data,
  );
}

class _CompactAvailability extends ConsumerStatefulWidget {
  final bool available;
  final WidgetRef ref;
  const _CompactAvailability({required this.available, required this.ref});
  @override
  ConsumerState<_CompactAvailability> createState() => _CompactAvailabilityState();
}

class _CompactAvailabilityState extends ConsumerState<_CompactAvailability> {
  late bool _value = widget.available;
  bool _busy = false;

  Future<void> _toggle(bool v) async {
    setState(() { _value = v; _busy = true; });
    final res = await ref.read(technicianRepositoryProvider).setAvailability(v);
    if (!mounted) return;
    res.when(
      success: (_) => ref.invalidate(technicianProfileProvider),
      failure: (f) { setState(() => _value = !v); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message))); },
    );
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: _busy ? null : () => _toggle(!_value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: _value ? Colors.white.withOpacity(0.2) : Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(_value ? Icons.check_circle : Icons.pause_circle_outline, color: _value ? Colors.greenAccent : Colors.white70, size: 16),
        const SizedBox(width: 8),
        Text(_value ? 'Available for jobs' : 'Off duty', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        if (_busy) ...[const SizedBox(width: 8), const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))],
      ]),
    ),
  );
}

class _SyncBanner extends StatelessWidget {
  final int count;
  const _SyncBanner({required this.count});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.tertiaryContainer,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(children: [
      Icon(Icons.sync_problem, color: Theme.of(context).colorScheme.onTertiaryContainer),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$count change${count == 1 ? '' : 's'} pending sync', style: TextStyle(fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onTertiaryContainer)),
        Text('Will upload automatically when back online', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onTertiaryContainer.withOpacity(0.75))),
      ])),
    ]),
  );
}

class _StatsRow extends StatelessWidget {
  final int today;
  final int upcoming;
  final int completed;
  const _StatsRow({required this.today, required this.upcoming, required this.completed});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Widget card(String label, int count, IconData icon, Color color) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withOpacity(0.2))),
        child: Column(children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 6),
          Text('$count', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
        ]),
      ),
    );
    return Row(children: [
      card('Today', today, Icons.today, cs.primary),
      const SizedBox(width: 10),
      card('Upcoming', upcoming, Icons.upcoming, Colors.orange),
      const SizedBox(width: 10),
      card('Done', completed, Icons.task_alt, Colors.green),
    ]);
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final int count;
  const _SectionHeader({required this.title, required this.count});
  @override
  Widget build(BuildContext context) => Row(children: [
    Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
    const SizedBox(width: 8),
    Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: Theme.of(context).colorScheme.primaryContainer, borderRadius: BorderRadius.circular(10)),
      child: Text('$count', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onPrimaryContainer))),
  ]);
}

class _EmptyCard extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyCard({required this.icon, required this.message});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 28),
    decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.4), borderRadius: BorderRadius.circular(14)),
    child: Column(children: [
      Icon(icon, size: 36, color: Theme.of(context).colorScheme.outline),
      const SizedBox(height: 8),
      Text(message, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
    ]),
  );
}

class _JobCard extends StatelessWidget {
  final Job job;
  const _JobCard(this.job);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = _statusColor(context, job.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push('/technician/jobs/${job.id}'),
        child: Row(children: [
          // Status color bar
          Container(width: 4, height: 80, decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.only(topLeft: Radius.circular(14), bottomLeft: Radius.circular(14)))),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (job.windowStart != null)
                    Text(DateFormat('HH:mm').format(job.windowStart!), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
                  const SizedBox(height: 2),
                  Text(job.serviceName ?? 'Service', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  if (job.customerName != null)
                    Text(job.customerName!, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (job.addressLine != null)
                    Text(job.addressLine!, style: TextStyle(fontSize: 12, color: cs.outline), maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  _StatusBadge(job.status),
                  if (job.needsAcceptance) ...[const SizedBox(height: 6), _NewBadge()],
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final JobStatus status;
  const _StatusBadge(this.status);
  @override
  Widget build(BuildContext context) {
    final color = _statusColor(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
      child: Text(status.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _NewBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: Colors.orange, borderRadius: BorderRadius.circular(6)),
    child: const Text('NEW', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5)),
  );
}