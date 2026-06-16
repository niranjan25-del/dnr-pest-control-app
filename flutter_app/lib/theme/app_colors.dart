// lib/theme/app_colors.dart
//
// Color tokens transcribed from the approved Final UI Design System. Brand green 500 =
// #1E8E5A. Dark mode lightens brand/accent for contrast per the spec.

import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // --- Primary (Green) ---
  static const primary50 = Color(0xFFE8F5EE);
  static const primary100 = Color(0xFFC5E7D4);
  static const primary200 = Color(0xFF9FD8B8);
  static const primary300 = Color(0xFF79C99C);
  static const primary400 = Color(0xFF4FB87F);
  static const primary500 = Color(0xFF1E8E5A); // brand
  static const primary600 = Color(0xFF197C4F);
  static const primary700 = Color(0xFF136540);
  static const primary800 = Color(0xFF0D4E31);
  static const primary900 = Color(0xFF083420);

  // --- Secondary (Deep Slate Blue) ---
  static const secondary50 = Color(0xFFEAEEF3);
  static const secondary100 = Color(0xFFC9D3DF);
  static const secondary300 = Color(0xFF7E94AC);
  static const secondary500 = Color(0xFF2F4B6E);
  static const secondary700 = Color(0xFF21364F);
  static const secondary900 = Color(0xFF142231);

  // --- Status ---
  static const success = Color(0xFF2BA84A);
  static const successBg = Color(0xFFE6F6EC);
  static const warning = Color(0xFFF5A623);
  static const warningBg = Color(0xFFFFF6E6);
  static const error = Color(0xFFD64545);
  static const errorBg = Color(0xFFFDEAEA);

  // --- Neutrals (light) ---
  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF7F9FA);
  static const neutral100 = Color(0xFFEDF1F3);
  static const border = Color(0xFFDDE3E8);
  static const placeholder = Color(0xFF9AA6B2);
  static const textSecondary = Color(0xFF5C6873);
  static const textPrimary = Color(0xFF2A323B);
  static const heading = Color(0xFF161B21);

  // --- Dark mode ---
  static const darkBg = Color(0xFF0E1419);
  static const darkSurface = Color(0xFF161D24);
  static const darkSurface2 = Color(0xFF1E2730);
  static const darkBorder = Color(0xFF2C3742);
  static const darkTextPrimary = Color(0xFFEAEEF1);
  static const darkTextSecondary = Color(0xFF9DAAB6);
  static const darkPrimary = Color(0xFF3FB47C); // lightened brand
  static const darkAccent = Color(0xFFFFB94D);
  static const darkSuccess = Color(0xFF43C063);
  static const darkWarning = Color(0xFFF0B43C);
  static const darkError = Color(0xFFEA6A6A);
}
