// lib/features/technician/technician_shell.dart
//
// Bottom-nav shell (Today · Jobs · Schedule · Profile). Reads `outboxSyncProvider` once to
// keep the connectivity-driven offline flush alive while the technician app is open.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'shared/application/technician_providers.dart';

class TechnicianShell extends ConsumerWidget {
  final StatefulNavigationShell shell;
  const TechnicianShell({super.key, required this.shell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(outboxSyncProvider); // keep offline flush alive
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.today_outlined), selectedIcon: Icon(Icons.today), label: 'Today'),
          NavigationDestination(icon: Icon(Icons.work_outline), selectedIcon: Icon(Icons.work), label: 'Jobs'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Schedule'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
