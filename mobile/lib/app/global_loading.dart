// lib/app/global_loading.dart
//
// App-wide loading overlay for blocking operations (e.g. processing a payment) that aren't
// tied to a single widget. Reference-counted so concurrent operations don't fight: each
// `show()` increments, each `hide()` decrements, and the overlay is visible while > 0.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class GlobalLoadingController extends StateNotifier<int> {
  GlobalLoadingController() : super(0);
  void show() => state = state + 1;
  void hide() => state = state > 0 ? state - 1 : 0;
  void reset() => state = 0;
}

final globalLoadingProvider = StateNotifierProvider<GlobalLoadingController, int>((ref) => GlobalLoadingController());

/// Wraps the app; paints a modal spinner over everything when loading count > 0.
class GlobalLoadingOverlay extends ConsumerWidget {
  final Widget child;
  const GlobalLoadingOverlay({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loading = ref.watch(globalLoadingProvider) > 0;
    return Stack(
      children: [
        child,
        if (loading)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0x66000000),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
      ],
    );
  }
}
