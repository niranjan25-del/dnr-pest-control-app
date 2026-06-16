// lib/features/auth/application/current_user_provider.dart
//
// Reactive current-user provider (the spec's "UserProvider"). Exposes GET /auth/me as a
// watchable async value so any screen can show the signed-in user's profile and react to
// auth changes. It auto-refetches when the global auth state flips (login/logout) and is a
// no-op (returns null) while unauthenticated, so it never fires /auth/me without a token.
//
// Usage:
//   final user = ref.watch(currentUserProvider);
//   user.when(data: ..., loading: ..., error: ...);
//   ref.invalidate(currentUserProvider); // force a refresh after a profile edit

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/result.dart';
import '../../../providers/auth_controller.dart';
import '../domain/entities/auth_user.dart';
import 'auth_providers.dart';

/// Fetches the authenticated user's profile, or null when unauthenticated.
/// Rebuilds automatically whenever the global [authControllerProvider] state changes.
final currentUserProvider = FutureProvider<AuthUser?>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (!auth.isAuthenticated) return null;

  final result = await ref.watch(authRepositoryProvider).fetchCurrentUser();
  return result.when(
    success: (user) => user,
    failure: (f) => throw f, // surfaces as AsyncError → ErrorView; interceptor handles 401s
  );
});

/// Convenience: the user id from the lightweight session state (no network call),
/// useful for guards/analytics that only need the id.
final sessionUserIdProvider = Provider<String?>((ref) => ref.watch(authControllerProvider).userId);
