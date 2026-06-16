// lib/features/technician/notifications/notification_center_screen.dart
//
// Reuses the shared NotificationsRepository/providers. Tap marks read; mark-all clears.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/data/notifications_repository.dart';
import '../../../shared/widgets/state_views.dart';

class TechnicianNotificationsScreen extends ConsumerWidget {
  const TechnicianNotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsListProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationsRepositoryProvider).markAllRead();
              ref.invalidate(notificationsListProvider);
              ref.invalidate(unreadNotificationsCountProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: AsyncValueView<List<AppNotification>>(
        value: notifications,
        onRetry: () => ref.invalidate(notificationsListProvider),
        isEmpty: (d) => d.isEmpty,
        empty: const EmptyView(icon: Icons.notifications_off_outlined, title: 'No notifications'),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(notificationsListProvider);
            ref.invalidate(unreadNotificationsCountProvider);
          },
          child: ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final n = items[i];
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: n.read ? context.colors.surfaceContainerHighest : context.colors.primaryContainer,
                  child: const Icon(Icons.notifications_outlined, size: 20),
                ),
                title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w400 : FontWeight.w700)),
                subtitle: Text([if (n.body != null) n.body!, if (n.createdAt != null) DateFormat.yMMMd().add_jm().format(n.createdAt!.toLocal())].join('\n')),
                isThreeLine: n.body != null,
                onTap: () async {
                  if (!n.read) {
                    await ref.read(notificationsRepositoryProvider).markRead(n.id);
                    ref.invalidate(notificationsListProvider);
                    ref.invalidate(unreadNotificationsCountProvider);
                  }
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
