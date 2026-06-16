// lib/features/customer/subscriptions/subscription_providers.dart
//
// Self-contained subscription DI + read provider + an action controller for
// pause/resume/cancel. Kept in the feature folder (not the shared providers file) so it
// composes additively without touching existing foundation/customer code.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/result.dart';
import '../../../providers/core_providers.dart';
import '../shared/models/subscription_models.dart';
import 'subscription_repository.dart';

final subscriptionRepositoryProvider =
    Provider<SubscriptionRepository>((ref) => SubscriptionRepository(ref.watch(dioProvider)));

/// List of the signed-in customer's subscriptions (AsyncValue for AsyncValueView).
final subscriptionsProvider = FutureProvider.autoDispose<List<Subscription>>((ref) async {
  final r = await ref.watch(subscriptionRepositoryProvider).list();
  return r.when(success: (d) => d, failure: (f) => throw f);
});

final subscriptionDetailProvider =
    FutureProvider.autoDispose.family<Subscription, String>((ref, id) async {
  final r = await ref.watch(subscriptionRepositoryProvider).detail(id);
  return r.when(success: (d) => d, failure: (f) => throw f);
});

/// Drives pause/resume/cancel. Exposes a simple busy flag; on success it invalidates the
/// list + detail so the UI reflects the new status. Returns an error message or null.
class SubscriptionActionController extends StateNotifier<bool> {
  final Ref _ref;
  SubscriptionActionController(this._ref) : super(false);

  Future<String?> pause(String id) => _run(id, (repo) => repo.pause(id));
  Future<String?> resume(String id) => _run(id, (repo) => repo.resume(id));
  Future<String?> cancel(String id, {String? reason}) => _run(id, (repo) => repo.cancel(id, reason: reason));

  Future<String?> _run(String id, Future<Result<Subscription>> Function(SubscriptionRepository) op) async {
    state = true;
    try {
      final res = await op(_ref.read(subscriptionRepositoryProvider));
      return res.when(
        success: (_) {
          _ref.invalidate(subscriptionsProvider);
          _ref.invalidate(subscriptionDetailProvider(id));
          return null;
        },
        failure: (f) => f.message,
      );
    } finally {
      state = false;
    }
  }
}

final subscriptionActionProvider =
    StateNotifierProvider<SubscriptionActionController, bool>((ref) => SubscriptionActionController(ref));
