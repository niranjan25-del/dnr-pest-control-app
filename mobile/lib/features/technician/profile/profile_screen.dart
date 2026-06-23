// lib/features/technician/profile/profile_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_providers.dart';
import '../shared/application/technician_providers.dart';
import '../shared/models/technician_models.dart';

class TechnicianProfileScreen extends ConsumerWidget {
  const TechnicianProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(technicianProfileProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      body: AsyncValueView<TechnicianProfile>(
        value: profile,
        onRetry: () => ref.invalidate(technicianProfileProvider),
        data: (p) => _ProfileContent(p),
      ),
    );
  }
}

class _ProfileContent extends ConsumerStatefulWidget {
  final TechnicianProfile p;
  const _ProfileContent(this.p);
  @override
  ConsumerState<_ProfileContent> createState() => _ProfileContentState();
}

class _ProfileContentState extends ConsumerState<_ProfileContent> {
  late bool _available = widget.p.isAvailable;
  bool _busy = false;

  Future<void> _toggleAvailability(bool v) async {
    setState(() { _available = v; _busy = true; });
    final res = await ref.read(technicianRepositoryProvider).setAvailability(v);
    if (!mounted) return;
    res.when(
      success: (_) => ref.invalidate(technicianProfileProvider),
      failure: (f) {
        setState(() => _available = !v);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
      },
    );
    setState(() => _busy = false);
  }

  String _initials(String name) => name.split(' ').where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();

  @override
  Widget build(BuildContext context) {
    final p  = widget.p;
    final cs = Theme.of(context).colorScheme;
    final expiringSoon = p.licenseExpiry != null && p.licenseExpiry!.isBefore(DateTime.now().add(const Duration(days: 60)));

    return CustomScrollView(
      slivers: [
        // ── Hero header ──
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          backgroundColor: cs.primary,
          foregroundColor: Colors.white,
          title: const Text('My profile', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                      colors: [cs.primary, Color.lerp(cs.primary, Colors.black, 0.4)!],
                    ),
                  ),
                ),
                // circles
                Positioned(left: -30, bottom: -30, child: Container(width: 150, height: 150, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.05)))),
                Positioned(right: -20, top: 20, child: Container(width: 100, height: 100, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.06)))),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                    child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                      // Avatar
                      Container(
                        width: 80, height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.2),
                          border: Border.all(color: Colors.white.withOpacity(0.4), width: 2.5),
                        ),
                        child: Center(
                          child: Text(
                            p.fullName.isNotEmpty ? _initials(p.fullName) : '?',
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(p.fullName, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                      if (p.email != null)
                        Text(p.email!, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
                    ]),
                  ),
                ),
              ],
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              // ── Availability toggle ──
              _SectionCard(children: [
                SwitchListTile(
                  value: _available,
                  onChanged: _busy ? null : _toggleAvailability,
                  title: const Text('Available for jobs', style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(_available ? 'You can receive new assignments' : 'You won\'t be assigned new jobs'),
                  secondary: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: Icon(_available ? Icons.check_circle : Icons.pause_circle_outline,
                        key: ValueKey(_available), color: _available ? Colors.green : cs.outline, size: 28),
                  ),
                  contentPadding: EdgeInsets.zero,
                ),
              ]),

              const SizedBox(height: 12),

              // ── Contact info ──
              _SectionCard(title: 'Contact', children: [
                _InfoTile(icon: Icons.phone_outlined, label: 'Phone', value: p.phone ?? '—'),
                _InfoTile(icon: Icons.email_outlined, label: 'Email', value: p.email ?? '—'),
              ]),

              const SizedBox(height: 12),

              // ── License ──
              _SectionCard(title: 'License & credentials', children: [
                _InfoTile(
                  icon: Icons.badge_outlined,
                  label: 'License no.',
                  value: p.licenseNumber ?? '—',
                  iconColor: expiringSoon ? cs.error : null,
                ),
                if (p.licenseExpiry != null)
                  _InfoTile(
                    icon: Icons.event_outlined,
                    label: 'Expiry',
                    value: DateFormat('d MMM yyyy').format(p.licenseExpiry!),
                    iconColor: expiringSoon ? cs.error : null,
                    trailing: expiringSoon
                        ? Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: cs.errorContainer, borderRadius: BorderRadius.circular(8)),
                            child: Text('Expiring soon', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: cs.onErrorContainer)))
                        : null,
                  ),
              ]),

              const SizedBox(height: 12),

              // ── Skills ──
              if (p.skills.isNotEmpty)
                _SectionCard(title: 'Skills', children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Wrap(spacing: 8, runSpacing: 8, children: p.skills.map((s) => Chip(
                      label: Text(s, style: const TextStyle(fontSize: 12)),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    )).toList()),
                  ),
                ]),

              if (p.skills.isNotEmpty) const SizedBox(height: 12),

              // ── Logout ──
              _SectionCard(children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: cs.errorContainer, shape: BoxShape.circle), child: Icon(Icons.logout, color: cs.error, size: 18)),
                  title: Text('Log out', style: TextStyle(color: cs.error, fontWeight: FontWeight.w600)),
                  trailing: Icon(Icons.arrow_forward_ios, size: 14, color: cs.error),
                  onTap: () => ref.read(logoutProvider)(),
                ),
              ]),

              const SizedBox(height: 80),
            ]),
          ),
        ),
      ],
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String? title;
  final List<Widget> children;
  const _SectionCard({this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (title != null) ...[
        Padding(padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Text(title!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: cs.onSurfaceVariant, letterSpacing: 0.5))),
      ],
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: cs.outlineVariant),
        ),
        child: Column(children: children),
      ),
    ]);
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? iconColor;
  final Widget? trailing;
  const _InfoTile({required this.icon, required this.label, required this.value, this.iconColor, this.trailing});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Icon(icon, size: 18, color: iconColor ?? cs.primary),
        const SizedBox(width: 12),
        SizedBox(width: 80, child: Text(label, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
        if (trailing != null) trailing!,
      ]),
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