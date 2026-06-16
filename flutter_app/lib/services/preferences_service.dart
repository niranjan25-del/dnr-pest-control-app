// lib/services/preferences_service.dart
//
// Non-sensitive key/value prefs (theme mode, onboarding, locale) via SharedPreferences.
// Initialized once at bootstrap so reads are synchronous afterward.

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/app_constants.dart';

class PreferencesService {
  final SharedPreferences _prefs;
  PreferencesService(this._prefs);

  static Future<PreferencesService> create() async =>
      PreferencesService(await SharedPreferences.getInstance());

  ThemeMode get themeMode {
    switch (_prefs.getString(PrefKeys.themeMode)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> setThemeMode(ThemeMode mode) =>
      _prefs.setString(PrefKeys.themeMode, mode.name);

  bool get onboardingComplete => _prefs.getBool(PrefKeys.onboardingComplete) ?? false;
  Future<void> setOnboardingComplete(bool v) => _prefs.setBool(PrefKeys.onboardingComplete, v);
}
