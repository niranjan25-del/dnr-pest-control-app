// test/unit/auth_validators_test.dart
//
// Validators are pure functions returning an error string or null — cheap to test
// exhaustively, and they back every auth form, so they get thorough coverage of the
// happy + boundary + invalid cases.

import 'package:flutter_test/flutter_test.dart';
import 'package:dnr_pest_control/features/auth/application/auth_validators.dart';

void main() {
  group('AuthValidators.email', () {
    test('accepts a well-formed address', () {
      expect(AuthValidators.email('user@dnr.test'), isNull);
    });
    test('rejects empty + malformed', () {
      expect(AuthValidators.email(''), isNotNull);
      expect(AuthValidators.email('not-an-email'), isNotNull);
      expect(AuthValidators.email('a@b'), isNotNull);
    });
  });

  group('AuthValidators.password', () {
    test('accepts a sufficiently strong password', () {
      expect(AuthValidators.password('Secret123'), isNull);
    });
    test('rejects too-short / empty', () {
      expect(AuthValidators.password(''), isNotNull);
      expect(AuthValidators.password('123'), isNotNull);
    });
  });

  group('AuthValidators.confirmPassword', () {
    test('passes when matching', () {
      expect(AuthValidators.confirmPassword('Secret123', 'Secret123'), isNull);
    });
    test('fails when different', () {
      expect(AuthValidators.confirmPassword('Secret123', 'Other999'), isNotNull);
    });
  });

  group('AuthValidators.fullName / phone / required', () {
    test('fullName rejects blank, accepts a real name', () {
      expect(AuthValidators.fullName(''), isNotNull);
      expect(AuthValidators.fullName('Asha Rao'), isNull);
    });
    test('phone validates format', () {
      expect(AuthValidators.phone('invalid'), isNotNull);
      expect(AuthValidators.phone('+919876543210'), isNull);
    });
    test('required flags empty', () {
      expect(AuthValidators.required(''), isNotNull);
      expect(AuthValidators.required('x'), isNull);
    });
  });
}
