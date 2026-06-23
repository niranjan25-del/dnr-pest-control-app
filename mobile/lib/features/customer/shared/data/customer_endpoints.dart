// lib/features/customer/shared/data/customer_endpoints.dart
//
// Endpoint paths (relative to the configured /api/v1 base). Centralized so changes are
// one-touch and match the API specification.

class CustomerEndpoints {
  CustomerEndpoints._();

  static const services = '/services';
  static String service(String id) => '/services/$id';

  static const bookings = '/bookings';
  static String booking(String id) => '/bookings/$id';
  static String cancelBooking(String id) => '/bookings/$id/cancel';

  static const addresses = '/customers/me/addresses';
  static String address(String id) => '/customers/me/addresses/$id';

  static const me = '/customers/me';

  static const paymentsIntent = '/payments/intent';
  static String confirmPayment(String id) => '/payments/$id/confirm';
  static const invoices = '/invoices';

  static const reviews = '/reviews';

  static const subscriptions = '/subscriptions';
  static String subscription(String id) => '/subscriptions/$id';
  static String pauseSubscription(String id) => '/subscriptions/$id/pause';
  static String resumeSubscription(String id) => '/subscriptions/$id/resume';
  static String cancelSubscription(String id) => '/subscriptions/$id/cancel';

  static const notifications = '/notifications';
  static String readNotification(String id) => '/notifications/$id/read';
  static const readAllNotifications = '/notifications/read-all';
}
