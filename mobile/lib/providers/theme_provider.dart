// lib/providers/theme_provider.dart
//
// Holds the active ThemeMode, seeded from persisted prefs and written back on change.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/preferences_service.dart';
import 'core_providers.dart';

class ThemeModeController extends StateNotifier<ThemeMode> {
  final PreferencesService _prefs;
  ThemeModeController(this._prefs) : super(_prefs.themeMode);

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await _prefs.setThemeMode(mode);
  }

  Future<void> toggle() => set(state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
}

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) => ThemeModeController(ref.watch(preferencesServiceProvider)),
);
