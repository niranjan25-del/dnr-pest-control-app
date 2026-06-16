// lib/features/auth/presentation/screens/splash_screen.dart
//
// Shown while AuthController restores the session on launch. No navigation logic here —
// GoRouter's redirect moves on once auth status resolves (foundation app_router.dart).

import 'package:flutter/material.dart';
import '../../../../theme/app_colors.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary500,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.shield_outlined, size: 72, color: Colors.white),
            SizedBox(height: 16),
            Text('DNR Pest Control', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
            SizedBox(height: 28),
            CircularProgressIndicator(color: Colors.white),
          ],
        ),
      ),
    );
  }
}
