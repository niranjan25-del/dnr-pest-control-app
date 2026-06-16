// lib/features/customer/dashboard/dashboard_screen.dart
//
// Home: quick-book CTA, upcoming bookings, recent bookings, and a notifications summary.
// Pulls bookings once and partitions client-side into upcoming/recent.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/utils/money.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/application/customer_providers.dart';
import '../shared/models/customer_models.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(bookingsProvider(null));
    final unread = ref.watch(unreadCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('DNR Pest Control'),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: (unread.valueOrNull ?? 0) > 0,
              label: Text('${unread.valueOrNull ?? 0}'),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () => context.push('/customer/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(bookingsProvider);
          ref.invalidate(unreadCountProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: context.colors.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Need pest control?', style: context.text.titleLarge),
                    const SizedBox(height: 4),
                    Text('Book a visit in a couple of minutes.', style: context.text.bodyMedium),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () => context.push('/customer/book'),
                      icon: const Icon(Icons.add),
                      label: const Text('Book a service'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            AsyncValueView<Paginated<Booking>>(
              value: bookings,
              onRetry: () => ref.invalidate(bookingsProvider),
              data: (page) {
                final upcoming = page.data.where((b) => b.isUpcoming).toList();
                final recent = page.data.where((b) => !b.isUpcoming).take(5).toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionHeader('Upcoming', onSeeAll: () => context.go('/customer/bookings')),
                    if (upcoming.isEmpty)
                      const EmptyView(icon: Icons.event_available_outlined, title: 'No upcoming visits')
                    else
                      ...upcoming.map((b) => _BookingTile(b)),
                    const SizedBox(height: 24),
                    _SectionHeader('Recent', onSeeAll: () => context.go('/customer/bookings')),
                    if (recent.isEmpty)
                      const EmptyView(icon: Icons.history, title: 'No past visits yet')
                    else
                      ...recent.map((b) => _BookingTile(b)),
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

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback onSeeAll;
  const _SectionHeader(this.title, {required this.onSeeAll});
  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(title, style: context.text.titleMedium), TextButton(onPressed: onSeeAll, child: const Text('See all'))],
      );
}

class _BookingTile extends StatelessWidget {
  final Booking booking;
  const _BookingTile(this.booking);
  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.pest_control_outlined),
        title: Text(booking.serviceName ?? 'Service'),
        subtitle: Text([
          if (booking.windowStart != null) '${booking.windowStart}'.split('.').first,
          booking.status,
        ].join('  •  ')),
        trailing: Text(Money.format(booking.price, currency: booking.currency)),
        onTap: () => context.go('/customer/bookings/${booking.id}'),
      ),
    );
  }
}
