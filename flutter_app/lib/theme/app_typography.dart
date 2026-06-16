// lib/theme/app_typography.dart
//
// Type scale from the design system (min body 14, never below 12). Uses the platform
// default family; swap `fontFamily` once the brand font is added to assets + pubspec.

import 'package:flutter/material.dart';

class AppTypography {
  AppTypography._();

  static const String? fontFamily = null; // set to brand font when bundled

  static TextTheme textTheme(Color primary, Color secondary, Color heading) => TextTheme(
        displaySmall: TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w700, color: heading),
        headlineMedium: TextStyle(fontSize: 24, height: 1.25, fontWeight: FontWeight.w700, color: heading),
        headlineSmall: TextStyle(fontSize: 20, height: 1.3, fontWeight: FontWeight.w600, color: heading),
        titleLarge: TextStyle(fontSize: 18, height: 1.35, fontWeight: FontWeight.w600, color: primary),
        titleMedium: TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w600, color: primary),
        bodyLarge: TextStyle(fontSize: 16, height: 1.5, fontWeight: FontWeight.w400, color: primary),
        bodyMedium: TextStyle(fontSize: 14, height: 1.45, fontWeight: FontWeight.w400, color: primary),
        bodySmall: TextStyle(fontSize: 12, height: 1.4, fontWeight: FontWeight.w400, color: secondary),
        labelLarge: TextStyle(fontSize: 14, height: 1.2, fontWeight: FontWeight.w600, color: primary),
        labelMedium: TextStyle(fontSize: 12, height: 1.2, fontWeight: FontWeight.w500, color: secondary),
      );
}
