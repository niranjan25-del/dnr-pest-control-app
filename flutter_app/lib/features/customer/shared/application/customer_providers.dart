// lib/features/customer/shared/application/customer_providers.dart
//
// Customer DI graph + read providers. Repositories wrap the shared Dio. FutureProviders
// expose async data to screens via AsyncValue (loading/error/data handled by AsyncValueView).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/result.dart';
import '../../../../providers/core_providers.dart';
import '../data/account_repository.dart';
import '../data/booking_repository.dart';
import '../data/payment_repository.dart';
import '../models/customer_models.dart';

// ---- Repositories ----
final catalogRepositoryProvider = Provider((ref) => CatalogRepository(ref.watch(dioProvider)));
final bookingRepositoryProvider = Provider((ref) => BookingRepository(ref.watch(dioProvider)));
final paymentRepositoryProvider = Provider((ref) => PaymentRepository(ref.watch(dioProvider)));
final accountRepositoryProvider = Provider((ref) => AccountRepository(ref.watch(dioProvider)));

T _orThrow<T>(Result<T> r) => r.when(success: (d) => d, failure: (f) => throw f);

// ---- Read providers (AsyncValue) ----
final servicesProvider = FutureProvider.autoDispose<List<Service>>((ref) async {
  return _orThrow(await ref.watch(catalogRepositoryProvider).listServices());
});

/// Bookings filtered by upcoming/history. `upcoming=null` → all.
final bookingsProvider =
    FutureProvider.autoDispose.family<Paginated<Booking>, String?>((ref, status) async {
  return _orThrow(await ref.watch(bookingRepositoryProvider).list(status: status));
});

final bookingDetailProvider =
    FutureProvider.autoDispose.family<Booking, String>((ref, id) async {
  return _orThrow(await ref.watch(bookingRepositoryProvider).detail(id));
});

final addressesProvider = FutureProvider.autoDispose<List<Address>>((ref) async {
  return _orThrow(await ref.watch(accountRepositoryProvider).listAddresses());
});

final profileProvider = FutureProvider.autoDispose<CustomerProfile>((ref) async {
  return _orThrow(await ref.watch(accountRepositoryProvider).profile());
});

final notificationsProvider =
    FutureProvider.autoDispose<Paginated<NotificationItem>>((ref) async {
  return _orThrow(await ref.watch(accountRepositoryProvider).notifications());
});

/// Unread count for the dashboard/badge.
final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final page = _orThrow(await ref.watch(accountRepositoryProvider).notifications(unreadOnly: true));
  return page.total;
});
