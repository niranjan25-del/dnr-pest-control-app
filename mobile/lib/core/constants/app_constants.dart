// lib/core/constants/app_constants.dart
//
// Static, environment-independent constants. Anything that varies by environment lives
// in AppEnvironment, not here.

class AppConstants {
  AppConstants._();

  static const String appName = 'DNR Pest Control';

  // Network
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);
  static const int maxRetries = 2;

  // Auth / API contract (matches backend)
  static const String accessTokenHeader = 'Authorization';
  static const String bearerPrefix = 'Bearer ';
  static const String refreshPath = '/auth/refresh';
  static const String loginPath = '/auth/login';

  // Pagination
  static const int defaultPageSize = 20;
}

/// Secure-storage keys (tokens, sensitive flags).
class StorageKeys {
  StorageKeys._();
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String userRole = 'user_role';
  static const String userId = 'user_id';
}

/// SharedPreferences keys (non-sensitive).
class PrefKeys {
  PrefKeys._();
  static const String themeMode = 'theme_mode';
  static const String onboardingComplete = 'onboarding_complete';
  static const String lastKnownLocale = 'locale';
}

/// App roles — mirror the backend UserRole (customer/technician + admin sub-roles).
/// Admin has limited mobile access; full admin is the web surface.
enum AppRole { customer, technician, admin, unknown }

AppRole appRoleFromString(String? raw) {
  switch (raw?.toUpperCase()) {
    case 'CUSTOMER':
      return AppRole.customer;
    case 'TECHNICIAN':
      return AppRole.technician;
    case 'ADMIN':
    case 'SUPER_ADMIN':
    case 'OPERATIONS_MANAGER':
    case 'DISPATCHER':
    case 'CUSTOMER_SUPPORT':
      return AppRole.admin;
    default:
      return AppRole.unknown;
  }
}
