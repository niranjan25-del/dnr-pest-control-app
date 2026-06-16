// lib/routes/app_routes.dart
//
// Centralized route path + name constants. Feature routes are added to these groups as
// each feature module lands (no screens in the foundation).

class AppRoutes {
  AppRoutes._();

  static const splash = '/';
  static const signIn = '/sign-in';

  // Role home shells (screens added by feature modules later).
  static const customerHome = '/customer';
  static const technicianHome = '/technician';
  static const adminHome = '/admin';
}
