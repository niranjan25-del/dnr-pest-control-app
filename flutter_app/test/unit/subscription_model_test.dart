// test/unit/subscription_model_test.dart
//
// The customer Subscription model drives the pause/resume/cancel buttons, so its status
// parsing and the can-action guards must exactly mirror the backend state machine
// (only ACTIVE pauses; only PAUSED resumes; ACTIVE/PAUSED cancel; terminal states do nothing).

import 'package:flutter_test/flutter_test.dart';
import 'package:dnr_pest_control/features/customer/shared/models/subscription_models.dart';

void main() {
  group('Subscription.fromJson', () {
    test('parses a flat payload', () {
      final s = Subscription.fromJson({
        'id': 'sub_1',
        'plan_name': 'Monthly Shield',
        'status': 'ACTIVE',
        'billing_cycle': 'MONTHLY',
        'price': '1499.00',
        'next_billing_date': '2026-07-01T00:00:00.000Z',
        'visits_per_cycle': 2,
      });
      expect(s.id, 'sub_1');
      expect(s.planName, 'Monthly Shield');
      expect(s.status, SubscriptionStatus.active);
      expect(s.billingCycle, 'MONTHLY');
      expect(s.price, 1499);
      expect(s.visitsPerCycle, 2);
      expect(s.nextBillingDate, isNotNull);
    });

    test('falls back to nested plan fields', () {
      final s = Subscription.fromJson({
        'id': 'sub_2',
        'status': 'PAUSED',
        'plan': {'name': 'Quarterly', 'price': 3999, 'billing_cycle': 'QUARTERLY', 'visits_per_cycle': 6},
      });
      expect(s.planName, 'Quarterly');
      expect(s.price, 3999);
      expect(s.billingCycle, 'QUARTERLY');
      expect(s.visitsPerCycle, 6);
    });

    test('maps unknown/missing status to unknown and tolerates missing fields', () {
      final s = Subscription.fromJson({'id': 'sub_3', 'status': 'WEIRD'});
      expect(s.status, SubscriptionStatus.unknown);
      expect(s.price, 0);
      expect(s.nextBillingDate, isNull);
      expect(s.planName, 'Plan'); // default label
    });
  });

  group('Subscription action guards', () {
    Subscription withStatus(SubscriptionStatus status) =>
        Subscription(id: 'x', planName: 'P', status: status, billingCycle: 'MONTHLY', price: 100);

    test('only ACTIVE can pause', () {
      expect(withStatus(SubscriptionStatus.active).canPause, isTrue);
      for (final s in [SubscriptionStatus.paused, SubscriptionStatus.cancelled, SubscriptionStatus.pending, SubscriptionStatus.expired]) {
        expect(withStatus(s).canPause, isFalse, reason: '$s should not be pausable');
      }
    });

    test('only PAUSED can resume', () {
      expect(withStatus(SubscriptionStatus.paused).canResume, isTrue);
      expect(withStatus(SubscriptionStatus.active).canResume, isFalse);
    });

    test('ACTIVE and PAUSED can cancel; terminal states cannot', () {
      expect(withStatus(SubscriptionStatus.active).canCancel, isTrue);
      expect(withStatus(SubscriptionStatus.paused).canCancel, isTrue);
      expect(withStatus(SubscriptionStatus.cancelled).canCancel, isFalse);
      expect(withStatus(SubscriptionStatus.expired).canCancel, isFalse);
    });
  });

  group('SubscriptionStatus labels', () {
    test('every status has a human label', () {
      for (final s in SubscriptionStatus.values) {
        expect(s.label, isNotEmpty);
      }
      expect(SubscriptionStatus.active.label, 'Active');
      expect(SubscriptionStatus.cancelled.label, 'Cancelled');
    });
  });
}
