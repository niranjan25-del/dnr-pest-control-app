// lib/features/shared/payments/presentation/payment_screens.dart
//
// Payment history (paid/issued invoices) + saved payment methods. Both reuse the shared
// payments controller. Adding a card uses Stripe SetupIntent (gated on the backend
// endpoint).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../shared/utils/money.dart';
import '../../../../shared/widgets/app_widgets.dart';
import '../../../../shared/widgets/state_views.dart';
import '../application/payments_controller.dart';

class PaymentHistoryScreen extends ConsumerWidget {
  const PaymentHistoryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(paymentHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Payment history')),
      body: AsyncValueView(
        value: history,
        onRetry: () => ref.invalidate(paymentHistoryProvider),
        isEmpty: (d) => d.isEmpty,
        empty: const EmptyView(icon: Icons.receipt_long_outlined, title: 'No payments yet'),
        data: (list) => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final inv = list[i];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.receipt_long_outlined),
                title: Text('Invoice ${inv.number}'),
                subtitle: Text([inv.status, if (inv.issuedAt != null) DateFormat.yMMMd().format(inv.issuedAt!)].join('  •  ')),
                trailing: Text(Money.format(inv.total, currency: inv.currency), style: context.text.titleSmall),
              ),
            );
          },
        ),
      ),
    );
  }
}

class SavedMethodsScreen extends ConsumerWidget {
  const SavedMethodsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(savedCardsProvider);
    final adding = ref.watch(savedMethodsControllerProvider);
    ref.listen(savedMethodsControllerProvider, (_, n) {
      if (n.isFailure) context.showSnack(n.failure?.message ?? 'Could not add card');
    });
    return Scaffold(
      appBar: AppBar(title: const Text('Payment methods')),
      body: Column(children: [
        Expanded(
          child: AsyncValueView(
            value: cards,
            onRetry: () => ref.invalidate(savedCardsProvider),
            isEmpty: (d) => d.isEmpty,
            empty: const EmptyView(icon: Icons.credit_card_outlined, title: 'No saved cards', subtitle: 'Add a card for faster checkout.'),
            data: (list) => ListView(
              padding: const EdgeInsets.all(16),
              children: list
                  .map((c) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.credit_card),
                          title: Text('${c.brand.toUpperCase()} •••• ${c.last4}'),
                          subtitle: c.expMonth != null ? Text('Expires ${c.expMonth}/${c.expYear}') : null,
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: AppButton(
              label: 'Add a card',
              icon: Icons.add,
              loading: adding.isSubmitting,
              onPressed: () => ref.read(savedMethodsControllerProvider.notifier).addCard(),
            ),
          ),
        ),
      ]),
    );
  }
}
