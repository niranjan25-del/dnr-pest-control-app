// lib/features/technician/technician_shell.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/data/notifications_repository.dart';
import 'shared/application/technician_providers.dart';

class TechnicianShell extends ConsumerWidget {
  final StatefulNavigationShell shell;
  const TechnicianShell({super.key, required this.shell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(outboxSyncProvider);
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      body: shell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: cs.surface,
          border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 16, offset: const Offset(0, -2))],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _NavItem(icon: Icons.today_outlined, selectedIcon: Icons.today, label: 'Today', index: 0, current: shell.currentIndex, badge: unread, onTap: () => shell.goBranch(0, initialLocation: 0 == shell.currentIndex)),
                _NavItem(icon: Icons.work_outline, selectedIcon: Icons.work_rounded, label: 'Jobs', index: 1, current: shell.currentIndex, onTap: () => shell.goBranch(1, initialLocation: 1 == shell.currentIndex)),
                _NavItem(icon: Icons.calendar_month_outlined, selectedIcon: Icons.calendar_month_rounded, label: 'Schedule', index: 2, current: shell.currentIndex, onTap: () => shell.goBranch(2, initialLocation: 2 == shell.currentIndex)),
                _NavItem(icon: Icons.person_outline_rounded, selectedIcon: Icons.person_rounded, label: 'Profile', index: 3, current: shell.currentIndex, onTap: () => shell.goBranch(3, initialLocation: 3 == shell.currentIndex)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int index;
  final int current;
  final int badge;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon, required this.selectedIcon, required this.label,
    required this.index, required this.current, required this.onTap, this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    final selected = index == current;
    final cs = Theme.of(context).colorScheme;
    final color = selected ? cs.primary : cs.onSurfaceVariant;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              isLabelVisible: badge > 0,
              label: Text('$badge'),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Icon(selected ? selectedIcon : icon, key: ValueKey(selected), color: color, size: 24),
              ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(fontSize: 11, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: color),
              child: Text(label),
            ),
          ],
        ),
      ),
    );
  }
}
