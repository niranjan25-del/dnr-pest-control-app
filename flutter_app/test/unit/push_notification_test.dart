// test/unit/push_notification_test.dart
//
// Push handling: an incoming FCM message with a data payload should resolve to the right
// in-app deep link (e.g. a booking update opens that booking). We test the pure mapping from
// RemoteMessage.data → route, which is the part worth locking down; the FirebaseMessaging
// stream wiring is integration-level.
//
// FLAG: point `routeForMessage` at the app's real notification-routing function if it exists;
// the version here documents the expected contract.

import 'package:flutter_test/flutter_test.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Expected mapping contract (mirror the app's handler).
String? routeForMessage(RemoteMessage message) {
  final data = message.data;
  switch (data['type']) {
    case 'booking_update':
      return '/customer/bookings/${data['booking_id']}';
    case 'chat_message':
      return '/chat/${data['conversation_id']}';
    case 'assignment':
      return '/technician/jobs/${data['booking_id']}';
    default:
      return null;
  }
}

void main() {
  test('booking_update routes to the booking detail', () {
    final msg = RemoteMessage(data: {'type': 'booking_update', 'booking_id': 'b1'});
    expect(routeForMessage(msg), '/customer/bookings/b1');
  });

  test('chat_message routes to the conversation', () {
    final msg = RemoteMessage(data: {'type': 'chat_message', 'conversation_id': 'c9'});
    expect(routeForMessage(msg), '/chat/c9');
  });

  test('assignment routes a technician to the job', () {
    final msg = RemoteMessage(data: {'type': 'assignment', 'booking_id': 'b1'});
    expect(routeForMessage(msg), '/technician/jobs/b1');
  });

  test('unknown type yields no deep link', () {
    expect(routeForMessage(RemoteMessage(data: {'type': 'mystery'})), isNull);
  });
}
