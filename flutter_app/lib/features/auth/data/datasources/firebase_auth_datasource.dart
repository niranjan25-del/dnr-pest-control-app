// lib/features/auth/data/datasources/firebase_auth_datasource.dart
//
// All Firebase Authentication interactions live here (IdP). Returns the Firebase ID
// token the backend verifies. Firebase errors are normalized to AppException so the
// repository can map them to user-friendly Failures.

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../../../../core/error/app_exception.dart';

class FirebaseAuthDatasource {
  final FirebaseAuth _auth;
  final GoogleSignIn _google;

  FirebaseAuthDatasource({FirebaseAuth? auth, GoogleSignIn? google})
      : _auth = auth ?? FirebaseAuth.instance,
        _google = google ?? GoogleSignIn();

  User? get currentUser => _auth.currentUser;

  Future<String> _idTokenOrThrow() async {
    final token = await _auth.currentUser?.getIdToken(true);
    if (token == null) throw const UnauthorizedException('No Firebase session');
    return token;
  }

  Future<String> signUpEmail({required String email, required String password, required String fullName}) async {
    try {
      final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
      await cred.user?.updateDisplayName(fullName);
      await cred.user?.sendEmailVerification();
      return _idTokenOrThrow();
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<String> signInEmail({required String email, required String password}) async {
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
      return _idTokenOrThrow();
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<String> signInGoogle() async {
    try {
      final account = await _google.signIn();
      if (account == null) throw const AppException('Sign-in cancelled', code: 'CANCELLED');
      final auth = await account.authentication;
      final credential = GoogleAuthProvider.credential(idToken: auth.idToken, accessToken: auth.accessToken);
      await _auth.signInWithCredential(credential);
      return _idTokenOrThrow();
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<String> signInApple() async {
    try {
      final apple = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
      final credential = OAuthProvider('apple.com').credential(
        idToken: apple.identityToken,
        accessToken: apple.authorizationCode,
      );
      await _auth.signInWithCredential(credential);
      return _idTokenOrThrow();
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<String> currentIdToken() => _idTokenOrThrow();

  Future<void> sendPasswordReset(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<void> confirmPasswordReset({required String code, required String newPassword}) async {
    try {
      await _auth.confirmPasswordReset(code: code, newPassword: newPassword);
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<void> sendEmailVerification() async {
    try {
      await _auth.currentUser?.sendEmailVerification();
    } on FirebaseAuthException catch (e) {
      throw _map(e);
    }
  }

  Future<bool> reloadEmailVerified() async {
    await _auth.currentUser?.reload();
    return _auth.currentUser?.emailVerified ?? false;
  }

  Future<void> signOut() async {
    await _google.signOut().catchError((_) {});
    await _auth.signOut();
  }

  /// Map Firebase error codes to readable, enumeration-safe messages.
  AppException _map(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-email':
        return const AppException('That email address is invalid.', code: 'invalid-email');
      case 'user-disabled':
        return const AppException('This account has been disabled.', code: 'user-disabled');
      case 'email-already-in-use':
        return const AppException('An account already exists for that email.', code: 'email-already-in-use');
      case 'weak-password':
        return const AppException('Password is too weak (min 8 characters).', code: 'weak-password');
      case 'wrong-password':
      case 'user-not-found':
      case 'invalid-credential':
        // Generic message to avoid account enumeration.
        return const UnauthorizedException('Incorrect email or password.');
      case 'too-many-requests':
        return const AppException('Too many attempts. Please try again later.', code: 'too-many-requests');
      case 'network-request-failed':
        return const NetworkException();
      default:
        return AppException(e.message ?? 'Authentication failed.', code: e.code);
    }
  }
}
