// lib/services/secure_storage_service.dart
//
// Wraps flutter_secure_storage for tokens + sensitive identifiers (Keychain on iOS,
// EncryptedSharedPreferences on Android). The ONLY place tokens are read/written.

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants/app_constants.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: StorageKeys.accessToken, value: accessToken);
    await _storage.write(key: StorageKeys.refreshToken, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: StorageKeys.accessToken);
  Future<String?> readRefreshToken() => _storage.read(key: StorageKeys.refreshToken);

  Future<void> saveSession({required String userId, required String role}) async {
    await _storage.write(key: StorageKeys.userId, value: userId);
    await _storage.write(key: StorageKeys.userRole, value: role);
  }

  Future<String?> readRole() => _storage.read(key: StorageKeys.userRole);
  Future<String?> readUserId() => _storage.read(key: StorageKeys.userId);

  Future<void> clear() async => _storage.deleteAll();
}
