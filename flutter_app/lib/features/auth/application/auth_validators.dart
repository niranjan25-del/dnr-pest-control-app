// lib/features/auth/application/auth_validators.dart
//
// Pure form validators (return null when valid, else an error string) for TextFormField.

class AuthValidators {
  AuthValidators._();

  static final _emailRe = RegExp(r'^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$');

  static String? email(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return 'Email is required';
    if (!_emailRe.hasMatch(value)) return 'Enter a valid email';
    return null;
  }

  static String? password(String? v) {
    final value = v ?? '';
    if (value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'At least 8 characters';
    return null;
  }

  static String? confirmPassword(String? v, String original) {
    if ((v ?? '').isEmpty) return 'Confirm your password';
    if (v != original) return 'Passwords do not match';
    return null;
  }

  static String? required(String? v, [String field = 'This field']) =>
      (v?.trim().isEmpty ?? true) ? '$field is required' : null;

  static String? fullName(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return 'Full name is required';
    if (value.length < 2) return 'Name is too short';
    return null;
  }

  static String? phone(String? v) {
    final value = (v ?? '').replaceAll(RegExp(r'[\s()-]'), '');
    if (value.isEmpty) return 'Phone is required';
    if (!RegExp(r'^\+?\d{7,15}$').hasMatch(value)) return 'Enter a valid phone number';
    return null;
  }
}
