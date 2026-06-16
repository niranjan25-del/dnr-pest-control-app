// lib/config/app_environment.dart
//
// Environment (flavor) configuration. Values are injected at build time via
// --dart-define so no secrets are committed. Selected once at bootstrap and exposed
// through a Riverpod provider; never read process env elsewhere.
//
// Run:  flutter run --dart-define=FLAVOR=dev
//       flutter build apk --dart-define=FLAVOR=prod --dart-define=API_BASE_URL=...

enum Flavor { dev, staging, prod }

class AppEnvironment {
  final Flavor flavor;
  final String apiBaseUrl; // includes /api/v1
  final String wsBaseUrl; // socket.io base (chat, location)
  final String googleMapsApiKey;
  final String stripePublishableKey;
  final bool enableLogging;

  const AppEnvironment({
    required this.flavor,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    required this.googleMapsApiKey,
    required this.stripePublishableKey,
    required this.enableLogging,
  });

  bool get isProd => flavor == Flavor.prod;

  /// Build the active environment from --dart-define values, with sane per-flavor
  /// defaults so dev "just works" without passing every flag.
  factory AppEnvironment.fromDartDefine() {
    const flavorName = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
    final flavor = switch (flavorName) {
      'prod' => Flavor.prod,
      'staging' => Flavor.staging,
      _ => Flavor.dev,
    };

    final defaults = switch (flavor) {
      Flavor.prod => const _Defaults(
          api: 'https://api.dnrpest.com/api/v1',
          ws: 'https://api.dnrpest.com',
          logging: false,
        ),
      Flavor.staging => const _Defaults(
          api: 'https://staging-api.dnrpest.com/api/v1',
          ws: 'https://staging-api.dnrpest.com',
          logging: true,
        ),
      Flavor.dev => const _Defaults(
          api: 'http://10.0.2.2:3000/api/v1', // Android emulator → host localhost
          ws: 'http://10.0.2.2:3000',
          logging: true,
        ),
    };

    return AppEnvironment(
      flavor: flavor,
      apiBaseUrl: const String.fromEnvironment('API_BASE_URL').isEmpty
          ? defaults.api
          : const String.fromEnvironment('API_BASE_URL'),
      wsBaseUrl: const String.fromEnvironment('WS_BASE_URL').isEmpty
          ? defaults.ws
          : const String.fromEnvironment('WS_BASE_URL'),
      googleMapsApiKey: const String.fromEnvironment('GOOGLE_MAPS_API_KEY'),
      stripePublishableKey: const String.fromEnvironment('STRIPE_PUBLISHABLE_KEY'),
      enableLogging:
          const bool.hasEnvironment('ENABLE_LOGGING') ? const bool.fromEnvironment('ENABLE_LOGGING') : defaults.logging,
    );
  }
}

class _Defaults {
  final String api;
  final String ws;
  final bool logging;
  const _Defaults({required this.api, required this.ws, required this.logging});
}
