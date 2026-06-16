// test/helpers/harness.dart
//
// Two harnesses used everywhere:
//   • createContainer(overrides) — a disposed-after-test ProviderContainer for unit/provider
//     tests (no widgets).
//   • pumpApp(tester, widget, overrides) — wraps a widget in ProviderScope + MaterialApp with
//     the app theme for widget tests; pumpRouterApp boots the real GoRouter for nav tests.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Disposable ProviderContainer for unit/provider tests.
ProviderContainer createContainer({List<Override> overrides = const []}) {
  final container = ProviderContainer(overrides: overrides);
  addTearDown(container.dispose);
  return container;
}

/// Pump a single widget/screen under ProviderScope + MaterialApp.
Future<void> pumpApp(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: child,
        // Keep tests theme-agnostic but realistic; swap to AppTheme.light if needed.
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Pump the app driven by a router (for navigation/redirect tests). Pass the real router
/// built from a container so redirects read overridden auth state.
Future<void> pumpRouterApp(
  WidgetTester tester,
  RouterConfig<Object> router, {
  List<Override> overrides = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}
