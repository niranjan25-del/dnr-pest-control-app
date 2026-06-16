// lib/features/shared/shared_routes.dart
//
// Routes for shared features, plugged into the foundation GoRouter and reachable from both
// the customer and technician shells (full-screen, above their bottom navs).
//
// INTEGRATION (lib/routes/app_router.dart): add `...sharedRoutes` to the top-level routes.
// Deep-link targets: /chat, /chat/:id, /track/:bookingId, /payments/history,
// /payments/methods, /settings.

import 'package:go_router/go_router.dart';
import 'chat/presentation/chat_screens.dart';
import 'maps/presentation/tracking_map_screen.dart';
import 'payments/presentation/payment_screens.dart';
import 'settings/presentation/settings_screen.dart';

final List<RouteBase> sharedRoutes = [
  GoRoute(path: '/chat', builder: (_, __) => const ConversationListScreen()),
  GoRoute(
    path: '/chat/:id',
    builder: (_, state) => ChatScreen(conversationId: state.pathParameters['id']!, title: state.extra as String? ?? 'Chat'),
  ),
  GoRoute(
    path: '/track/:bookingId',
    builder: (_, state) {
      final extra = state.extra is Map ? state.extra as Map : const {};
      return TrackingMapScreen(
        bookingId: state.pathParameters['bookingId']!,
        destLat: (extra['lat'] as num?)?.toDouble(),
        destLng: (extra['lng'] as num?)?.toDouble(),
      );
    },
  ),
  GoRoute(path: '/payments/history', builder: (_, __) => const PaymentHistoryScreen()),
  GoRoute(path: '/payments/methods', builder: (_, __) => const SavedMethodsScreen()),
  GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
];
