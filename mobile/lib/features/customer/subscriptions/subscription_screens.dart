// lib/features/customer/subscriptions/subscription_screens.dart
//
// Subscription Management UI:
//   • SubscriptionListScreen   — all of the customer's plans with status + quick actions
//   • SubscriptionDetailScreen — full detail + pause / resume / cancel
// Uses AsyncValueView for loading/error/empty, the action controller for mutations (with a
// busy state + snackbar feedback), and theme tokens so it's dark-mode compatible.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/extensions/context_extensions.dart';
import '../../../shared/widgets/state_views.dart';
import '../shared/models/subscription_models.dart';
import 'subscription_providers.dart';

class SubscriptionListScreen extends ConsumerWidget {
  const SubscriptionListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subs = ref.watch(subscriptionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Subscriptions')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(subscriptionsProvider),
        child: AsyncValueView<List<Subscription>>(
          value: subs,
          onRetry: () => ref.invalidate(subscriptionsProvider),
          isEmpty: (d) => d.isEmpty,
          empty: const EmptyView(
            icon: Icons.event_repeat_outlined,
            title: 'No subscriptions yet',
            subtitle: 'Recurring plans you set up will appear here.',
          ),
          data: (list) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _SubscriptionCard(sub: list[i]),
          ),
        ),
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  final Subscription sub;
  const _SubscriptionCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Text(sub.planName, style: context.text.titleMedium),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${sub.billingCycle.toLowerCase()} • ₹${sub.price}'
            '${sub.nextBillingDate != null ? '\nNext billing: ${_d(sub.nextBillingDate!)}' : ''}',
          ),
        ),
        isThreeLine: sub.nextBillingDate != null,
        trailing: _StatusChip(status: sub.status),
        onTap: () => context.push('/customer/subscriptions/${sub.id}'),
      ),
    );
  }

  static String _d(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class _StatusChip extends StatelessWidget {
  final SubscriptionStatus status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = switch (status) {
      SubscriptionStatus.active => c.primary,
      SubscriptionStatus.paused => Colors.orange,
      SubscriptionStatus.cancelled || SubscriptionStatus.expired => c.error,
      _ => c.outline,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status.label, style: context.text.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class SubscriptionDetailScreen extends ConsumerWidget {
  final String subscriptionId;
  const SubscriptionDetailScreen({super.key, required this.subscriptionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(subscriptionDetailProvider(subscriptionId));
    final busy = ref.watch(subscriptionActionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Subscription')),
      body: AsyncValueView<Subscription>(
        value: detail,
        onRetry: () => ref.invalidate(subscriptionDetailProvider(subscriptionId)),
        data: (sub) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text(sub.planName, style: context.text.headlineSmall)),
                _StatusChip(status: sub.status),
              ],
            ),
            const SizedBox(height: 16),
            _row(context, 'Billing cycle', sub.billingCycle.toLowerCase()),
            _row(context, 'Price', '₹${sub.price}'),
            if (sub.visitsPerCycle != null) _row(context, 'Visits per cycle', '${sub.visitsPerCycle}'),
            if (sub.nextBillingDate != null) _row(context, 'Next billing', _SubscriptionCard._d(sub.nextBillingDate!)),
            if (sub.nextServiceDate != null) _row(context, 'Next service', _SubscriptionCard._d(sub.nextServiceDate!)),
            const SizedBox(height: 24),
            if (sub.canPause)
              FilledButton.tonalIcon(
                onPressed: busy ? null : () => _act(context, ref, () => ref.read(subscriptionActionProvider.notifier).pause(sub.id), 'Subscription paused'),
                icon: const Icon(Icons.pause),
                label: const Text('Pause subscription'),
              ),
            if (sub.canResume)
              FilledButton.icon(
                onPressed: busy ? null : () => _act(context, ref, () => ref.read(subscriptionActionProvider.notifier).resume(sub.id), 'Subscription resumed'),
                icon: const Icon(Icons.play_arrow),
                label: const Text('Resume subscription'),
              ),
            if (sub.canCancel) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: busy ? null : () => _confirmCancel(context, ref, sub.id),
                icon: Icon(Icons.cancel_outlined, color: context.colors.error),
                label: Text('Cancel subscription', style: TextStyle(color: context.colors.error)),
              ),
            ],
            if (busy) const Padding(padding: EdgeInsets.only(top: 16), child: Center(child: CircularProgressIndicator())),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: context.text.bodyMedium?.copyWith(color: context.colors.outline)),
            Text(v, style: context.text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Future<void> _act(BuildContext context, WidgetRef ref, Future<String?> Function() op, String okMsg) async {
    final err = await op();
    if (!context.mounted) return;
    context.showSnack(err ?? okMsg);
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref, String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel subscription?'),
        content: const Text('Your recurring visits will stop. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Cancel it')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _act(context, ref, () => ref.read(subscriptionActionProvider.notifier).cancel(id), 'Subscription cancelled');
  }
}
