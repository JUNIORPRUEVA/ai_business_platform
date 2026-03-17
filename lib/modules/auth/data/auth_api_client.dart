import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/config/app_backend_config.dart';
import '../domain/auth_session.dart';

class AuthApiException implements Exception {
  const AuthApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class AuthApiClient {
  AuthApiClient({
    http.Client? client,
    String? baseUrl,
    Duration timeout = const Duration(seconds: 20),
  })  : _client = client ?? http.Client(),
        _baseUrl = resolveBackendUrl(
          preferred: baseUrl,
          fallback: const String.fromEnvironment('APP_BACKEND_URL'),
        ),
        _timeout = timeout;

  final http.Client _client;
  final String _baseUrl;
  final Duration _timeout;

  Future<String> registerCompany({
    required String companyName,
    required String adminName,
    required String email,
    required String password,
  }) async {
    final response = await _send(
      () => _client.post(
        _buildUri('/auth/register-company'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'companyName': companyName,
          'adminName': adminName,
          'email': email,
          'password': password,
        }),
      ),
    );

    final payload = _decodeObject(response.body);
    return payload['accessToken'] as String;
  }

  Future<String> login({
    required String email,
    required String password,
    String? companyId,
  }) async {
    final response = await _send(
      () => _client.post(
        _buildUri('/auth/login'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'email': email,
          'password': password,
          if (companyId != null && companyId.trim().isNotEmpty)
            'companyId': companyId,
        }),
      ),
    );

    final payload = _decodeObject(response.body);
    return payload['accessToken'] as String;
  }

  Future<AuthSession> getSession(String token) async {
    final userResponse = await _send(
      () => _client.get(
        _buildUri('/users/me'),
        headers: _authorizedHeaders(token),
      ),
    );
    final companyResponse = await _send(
      () => _client.get(
        _buildUri('/companies/me'),
        headers: _authorizedHeaders(token),
      ),
    );

    final userJson = _decodeObject(userResponse.body);
    final avatarKey = userJson['avatarKey'] as String?;
    final avatarUrl = await _resolveAvatarUrl(token, avatarKey);

    return AuthSession(
      user: AuthUser.fromJson({
        ...userJson,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      }),
      company: AuthCompany.fromJson(_decodeObject(companyResponse.body)),
    );
  }

  Future<AuthSession> updateProfile({
    required String token,
    required String name,
    String? avatarKey,
  }) async {
    await _send(
      () => _client.patch(
        _buildUri('/users/me'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({
          'name': name,
          'avatarKey': avatarKey,
        }),
      ),
    );

    return getSession(token);
  }

  Future<AuthSession> updateCompany({
    required String token,
    required String name,
    String? phone,
    String? email,
    String? website,
    String? taxId,
    String? addressLine1,
    String? addressLine2,
    String? city,
    String? regionState,
    String? country,
    String? postalCode,
    String? description,
  }) async {
    await _send(
      () => _client.patch(
        _buildUri('/companies/me'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({
          'name': name,
          'phone': _normalizeOptional(phone),
          'email': _normalizeOptional(email),
          'website': _normalizeOptional(website),
          'taxId': _normalizeOptional(taxId),
          'addressLine1': _normalizeOptional(addressLine1),
          'addressLine2': _normalizeOptional(addressLine2),
          'city': _normalizeOptional(city),
          'state': _normalizeOptional(regionState),
          'country': _normalizeOptional(country),
          'postalCode': _normalizeOptional(postalCode),
          'description': _normalizeOptional(description),
        }),
      ),
    );

    return getSession(token);
  }

  Future<String> uploadAvatar({
    required String token,
    required Uint8List bytes,
    required String fileName,
    required String contentType,
  }) async {
    final presignResponse = await _send(
      () => _client.post(
        _buildUri('/storage/presign-upload'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({
          'folder': 'media',
          'filename': fileName,
          'contentType': contentType,
        }),
      ),
    );

    final presignPayload = _decodeObject(presignResponse.body);
    final uploadUrl = presignPayload['url'] as String;
    final uploadResponse = await _client
        .put(
          Uri.parse(uploadUrl),
          headers: {
            'Content-Type': contentType,
          },
          body: bytes,
        )
        .timeout(_timeout);

    if (uploadResponse.statusCode < 200 || uploadResponse.statusCode >= 300) {
      throw AuthApiException(
        'No se pudo subir la imagen al storage.',
        statusCode: uploadResponse.statusCode,
      );
    }

    return presignPayload['key'] as String;
  }

  Map<String, String> get _jsonHeaders => const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Map<String, String> _authorizedHeaders(String token) => {
        ..._jsonHeaders,
        'Authorization': 'Bearer $token',
      };

  Uri _buildUri(String path) {
    final normalizedBase = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$normalizedBase$normalizedPath');
  }

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(_timeout);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      }

      final message = _extractError(response.body) ??
          'Request failed with status ${response.statusCode}.';
      throw AuthApiException(message, statusCode: response.statusCode);
    } on TimeoutException {
      throw const AuthApiException('La solicitud tardó demasiado.');
    } on http.ClientException catch (error) {
      throw AuthApiException(
          'No se pudo conectar al backend: ${error.message}');
    }
  }

  Map<String, dynamic> _decodeObject(String source) {
    final decoded = jsonDecode(source);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    throw const AuthApiException('Respuesta JSON inválida del backend.');
  }

  String? _extractError(String source) {
    final trimmed = source.trimLeft();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      return 'El backend devolvio una pagina HTML en lugar de JSON. Verifica que APP_BACKEND_URL apunte al API correcto y que el backend este encendido.';
    }

    try {
      final decoded = jsonDecode(source);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'] ?? decoded['error'];
        if (message is String && message.trim().isNotEmpty) {
          return message;
        }
      }
    } catch (_) {
      if (source.trim().isNotEmpty) {
        return source.trim();
      }
    }
    return null;
  }

  String? _normalizeOptional(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }
    return trimmed;
  }

  Future<String?> _resolveAvatarUrl(String token, String? avatarKey) async {
    if (avatarKey == null || avatarKey.trim().isEmpty) {
      return null;
    }

    try {
      final response = await _send(
        () => _client.get(
          _buildUri(
            '/storage/presign-download?key=${Uri.encodeQueryComponent(avatarKey)}',
          ),
          headers: _authorizedHeaders(token),
        ),
      );

      final payload = _decodeObject(response.body);
      return payload['url'] as String?;
    } on AuthApiException {
      return null;
    }
  }
}
