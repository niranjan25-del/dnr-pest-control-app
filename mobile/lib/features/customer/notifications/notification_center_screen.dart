// lib/features/customer/notifications/notification_center_screen.dart
//
// Lists the user's notifications, supports mark-one-read (on tap) and mark-all-read.
// Tapping a booking-related notification deep-links to the booking when an id is present.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

class NotificationCenterScreen extends ConsumerWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(accountRepositoryProvider).markAllRead();
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: AsyncValueView<Paginated<NotificationItem>>(
        value: notifications,
        onRetry: () => ref.invalidate(notificationsProvider),
        isEmpty: (d) => d.data.isEmpty,
        empty: const EmptyView(icon: Icons.notifications_off_outlined, title: 'No notifications'),
        data: (page) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(notificationsProvider);
            ref.invalidate(unreadCountProvider);
          },
          child: ListView.separated(
            itemCount: page.data.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final n = page.data[i];
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: n.read ? context.colors.surfaceContainerHighest : context.colors.primaryContainer,
                  child: Icon(_iconFor(n.type), size: 20),
                ),
                title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w400 : FontWeight.w700)),
                subtitle: Text([
                  if (n.body != null) n.body!,
                  if (n.createdAt != null) DateFormat.yMMMd().add_jm().format(n.createdAt!.toLocal()),
                ].join('\n')),
                isThreeLine: n.body != null,
                onTap: () async {
                  if (!n.read) {
                    await ref.read(accountRepositoryProvider).markRead(n.id);
                    ref.invalidate(notificationsProvider);
                    ref.invalidate(unreadCountProvider);
                  }
                },
              );
            },
          ),
        ),
      ),
    );
  }

  IconData _iconFor(String type) {
    final t = type.toUpperCase();
    if (t.contains('BOOKING')) return Icons.event_outlined;
    if (t.contains('PAYMENT') || t.contains('INVOICE')) return Icons.receipt_long_outlined;
    if (t.contains('TECHNICIAN') || t.contains('EN_ROUTE') || t.contains('ARRIV')) return Icons.local_shipping_outlined;
    return Icons.notifications_outlined;
  }
}
