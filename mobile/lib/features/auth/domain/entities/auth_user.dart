// lib/features/auth/domain/entities/auth_user.dart
//
// Domain entity for the authenticated user (framework-agnostic; no JSON here).

class AuthUser {
  final String id;
  final String email;
  final String role; // backend UserRole (e.g. CUSTOMER, TECHNICIAN, OPERATIONS_MANAGER)
  final String? fullName;
  final bool emailVerified;

  const AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.emailVerified = false,
  });
}
