// test/fixtures/fixtures.dart
//
// Deterministic test data builders. Entity builders take overridable named args so a test
// declares only the field under scrutiny; JSON maps mirror the backend's snake_case bodies
// for datasource/parsing tests. Keep all sample data here so specs stay short and intent is
// obvious.

import 'package:dnr_pest_control/features/auth/domain/entities/auth_session.dart';
import 'package:dnr_pest_control/features/auth/domain/entities/auth_user.dart';

class Fixtures {
  static AuthUser user({
    String id = 'user-1',
    String email = 'customer@dnr.test',
    String fullName = 'Test Customer',
    String role = 'CUSTOMER',
  }) =>
      AuthUser(id: id, email: email, fullName: fullName, role: role);

  static AuthSession session({
    String accessToken = 'access-token-xyz',
    String refreshToken = 'refresh-token-xyz',
    AuthUser? authUser,
  }) =>
      AuthSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: authUser ?? user(),
      );

  /// Backend login response body (snake_case), for datasource parsing tests.
  static Map<String, dynamic> loginResponseJson() => {
        'access_token': 'access-token-xyz',
        'refresh_token': 'refresh-token-xyz',
        'user': {
          'id': 'user-1',
          'email': 'customer@dnr.test',
          'full_name': 'Test Customer',
          'role': 'CUSTOMER',
        },
      };

  /// Backend error envelope, for failure-mapping tests.
  static Map<String, dynamic> errorEnvelope({
    String code = 'INVALID_CREDENTIALS',
    String message = 'Email or password is incorrect',
  }) =>
      {
        'error': {'code': code, 'message': message, 'details': null, 'request_id': 'req-1'},
      };

  static Map<String, dynamic> bookingJson({
    String id = 'booking-1',
    String status = 'PENDING',
  }) =>
      {
        'id': id,
        'status': status,
        'service_id': 'svc-1',
        'address_id': 'addr-1',
        'scheduled_window_start': '2026-06-10T09:00:00.000Z',
        'scheduled_window_end': '2026-06-10T12:00:00.000Z',
        'price': '1499.00',
        'currency': 'INR',
      };
}
