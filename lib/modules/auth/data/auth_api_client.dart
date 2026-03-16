import 'dart:async';
import 'dart:convert';

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
        _buildUri('/auth/me'),
        headers: _authorizedHeaders(token),
      ),
    );
    final companyResponse = await _send(
      () => _client.get(
        _buildUri('/companies/me'),
        headers: _authorizedHeaders(token),
      ),
    );

    return AuthSession(
      user: AuthUser.fromJson(_decodeObject(userResponse.body)),
      company: AuthCompany.fromJson(_decodeObject(companyResponse.body)),
    );
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
      throw AuthApiException('No se pudo conectar al backend: ${error.message}');
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
}
