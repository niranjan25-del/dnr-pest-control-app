// lib/features/customer/shared/models/subscription_models.dart
//
// Customer-facing subscription model. Mirrors the backend Subscription shape (snake_case
// JSON). Status maps to the backend SubscriptionStatus enum; only ACTIVE can be paused,
// only PAUSED can be resumed, and ACTIVE/PAUSED can be cancelled (terminal states cannot).

enum SubscriptionStatus { pending, active, paused, cancelled, expired, unknown }

SubscriptionStatus _statusFrom(String? s) {
  switch ((s ?? '').toUpperCase()) {
    case 'PENDING':
      return SubscriptionStatus.pending;
    case 'ACTIVE':
      return SubscriptionStatus.active;
    case 'PAUSED':
      return SubscriptionStatus.paused;
    case 'CANCELLED':
      return SubscriptionStatus.cancelled;
    case 'EXPIRED':
      return SubscriptionStatus.expired;
    default:
      return SubscriptionStatus.unknown;
  }
}

class Subscription {
  final String id;
  final String planName;
  final SubscriptionStatus status;
  final String billingCycle; // WEEKLY/MONTHLY/QUARTERLY/YEARLY
  final num price; // INR, parsed as num (money is Decimal on the server)
  final DateTime? nextBillingDate;
  final DateTime? nextServiceDate;
  final int? visitsPerCycle;

  const Subscription({
    required this.id,
    required this.planName,
    required this.status,
    required this.billingCycle,
    required this.price,
    this.nextBillingDate,
    this.nextServiceDate,
    this.visitsPerCycle,
  });

  bool get canPause => status == SubscriptionStatus.active;
  bool get canResume => status == SubscriptionStatus.paused;
  bool get canCancel => status == SubscriptionStatus.active || status == SubscriptionStatus.paused;

  static DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());

  factory Subscription.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'] is Map<String, dynamic> ? json['plan'] as Map<String, dynamic> : const {};
    return Subscription(
      id: json['id']?.toString() ?? '',
      planName: (json['plan_name'] ?? plan['name'] ?? 'Plan').toString(),
      status: _statusFrom(json['status']?.toString()),
      billingCycle: (json['billing_cycle'] ?? plan['billing_cycle'] ?? '').toString(),
      price: num.tryParse((json['price'] ?? plan['price'] ?? 0).toString()) ?? 0,
      nextBillingDate: _date(json['next_billing_date']),
      nextServiceDate: _date(json['next_service_date']),
      visitsPerCycle: int.tryParse((json['visits_per_cycle'] ?? plan['visits_per_cycle'] ?? '').toString()),
    );
  }
}

extension SubscriptionStatusLabel on SubscriptionStatus {
  String get label {
    switch (this) {
      case SubscriptionStatus.pending:
        return 'Pending';
      case SubscriptionStatus.active:
        return 'Active';
      case SubscriptionStatus.paused:
        return 'Paused';
      case SubscriptionStatus.cancelled:
        return 'Cancelled';
      case SubscriptionStatus.expired:
        return 'Expired';
      case SubscriptionStatus.unknown:
        return 'Unknown';
    }
  }
}
