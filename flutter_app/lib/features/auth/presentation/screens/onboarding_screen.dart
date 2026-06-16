// lib/features/auth/presentation/screens/onboarding_screen.dart
//
// First-run intro carousel. Marks onboarding complete (PreferencesService) and routes to
// sign-in. Shown only when `!prefs.onboardingComplete` (gate this in the router/redirect
// when wiring; kept simple here).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../../../providers/core_providers.dart';
import '../auth_routes.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  static const _slides = [
    ('Book trusted pest control', 'Schedule treatments in a few taps.', Icons.calendar_today_outlined),
    ('Track your technician', 'See live arrival and ETA on the day.', Icons.location_on_outlined),
    ('Reports & history', 'Service reports and invoices, all in one place.', Icons.description_outlined),
  ];

  Future<void> _finish() async {
    await ref.read(preferencesServiceProvider).setOnboardingComplete(true);
    if (mounted) context.go(AuthRoutes.signIn);
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _page == _slides.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(onPressed: _finish, child: const Text('Skip')),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (i) => setState(() => _page = i),
                itemCount: _slides.length,
                itemBuilder: (_, i) {
                  final s = _slides[i];
                  return Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(s.$3, size: 96, color: context.colors.primary),
                        const SizedBox(height: 32),
                        Text(s.$1, style: context.text.headlineSmall, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        Text(s.$2, style: context.text.bodyMedium, textAlign: TextAlign.center),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton(
                onPressed: () => isLast
                    ? _finish()
                    : _controller.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeOut),
                child: Text(isLast ? 'Get started' : 'Next'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
