// lib/features/auth/presentation/auth_routes.dart
//
// Auth route paths + the GoRoute list to plug into the foundation router. The splash and
// sign-in paths reuse the foundation's AppRoutes constants so redirects keep working; the
// rest are auth-feature additions.
//
// INTEGRATION (in lib/routes/app_router.dart):
//   import '../features/auth/presentation/auth_routes.dart';
//   routes: [ ...authRoutes, /* role home routes */ ],
// and delete the foundation's placeholder Splash/SignIn routes (these replace them).

import 'package:go_router/go_router.dart';
import '../../../routes/app_routes.dart';
import 'screens/email_verification_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/register_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/splash_screen.dart';

class AuthRoutes {
  AuthRoutes._();
  static const splash = AppRoutes.splash; // '/'
  static const signIn = AppRoutes.signIn; // '/sign-in'
  static const onboarding = '/onboarding';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';
  static const emailVerification = '/verify-email';
  static const profileSetup = '/profile-setup';
}

final List<RouteBase> authRoutes = [
  GoRoute(path: AuthRoutes.splash, builder: (_, __) => const SplashScreen()),
  GoRoute(path: AuthRoutes.onboarding, builder: (_, __) => const OnboardingScreen()),
  GoRoute(path: AuthRoutes.signIn, builder: (_, __) => const LoginScreen()),
  GoRoute(path: AuthRoutes.register, builder: (_, __) => const RegisterScreen()),
  GoRoute(path: AuthRoutes.forgotPassword, builder: (_, __) => const ForgotPasswordScreen()),
  GoRoute(
    path: AuthRoutes.resetPassword,
    builder: (_, state) => ResetPasswordScreen(oobCode: state.uri.queryParameters['oobCode']),
  ),
  GoRoute(path: AuthRoutes.emailVerification, builder: (_, __) => const EmailVerificationScreen()),
  GoRoute(path: AuthRoutes.profileSetup, builder: (_, __) => const ProfileSetupScreen()),
];
