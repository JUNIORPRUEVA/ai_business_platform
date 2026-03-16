import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../../core/config/app_backend_config.dart';

class BotConfigurationCenterApiException implements Exception {
  const BotConfigurationCenterApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class BotConfigurationCenterApiClient {
  BotConfigurationCenterApiClient({
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

  Future<Map<String, dynamic>> getJson(
    String path, {
    required String token,
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      () => _client.get(
        _buildUri(path, queryParameters),
        headers: _authorizedHeaders(token),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<List<dynamic>> getJsonList(
    String path, {
    required String token,
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      () => _client.get(
        _buildUri(path, queryParameters),
        headers: _authorizedHeaders(token),
      ),
    );
    return _decodeList(response.body);
  }

  Future<Map<String, dynamic>> putJson(
    String path,
    Map<String, dynamic> body, {
    required String token,
  }) async {
    final response = await _send(
      () => _client.put(
        _buildUri(path),
        headers: _authorizedHeaders(token),
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body, {
    required String token,
  }) async {
    final response = await _send(
      () => _client.post(
        _buildUri(path),
        headers: _authorizedHeaders(token),
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> patchJson(
    String path,
    Map<String, dynamic> body, {
    required String token,
  }) async {
    final response = await _send(
      () => _client.patch(
        _buildUri(path),
        headers: _authorizedHeaders(token),
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<void> delete(
    String path, {
    required String token,
  }) async {
    await _send(
      () => _client.delete(
        _buildUri(path),
        headers: _authorizedHeaders(token),
      ),
    );
  }

  Future<void> uploadBytesToUrl({
    required String url,
    required Uint8List bytes,
    String? contentType,
  }) async {
    final response = await _send(
      () => _client.put(
        Uri.parse(url),
        headers: {
          if (contentType != null && contentType.trim().isNotEmpty)
            'Content-Type': contentType,
        },
        body: bytes,
      ),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw BotConfigurationCenterApiException(
        'No se pudo subir el documento al storage.',
        statusCode: response.statusCode,
      );
    }
  }

  Map<String, String> _authorizedHeaders(String token) => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  Uri _buildUri(String path, [Map<String, String>? queryParameters]) {
    final normalizedBase = _baseUrl.endsWith('/')
        ? _baseUrl.substring(0, _baseUrl.length - 1)
        : _baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';

    return Uri.parse('$normalizedBase$normalizedPath')
        .replace(queryParameters: queryParameters);
  }

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(_timeout);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      }

      throw BotConfigurationCenterApiException(
        _extractError(response.body) ??
            'La solicitud falló con estado ${response.statusCode}.',
        statusCode: response.statusCode,
      );
    } on TimeoutException {
      throw const BotConfigurationCenterApiException(
        'La solicitud al centro de configuración tardó demasiado.',
      );
    } on http.ClientException catch (error) {
      throw BotConfigurationCenterApiException(
        'No se pudo conectar al backend: ${error.message}',
      );
    }
  }

  Map<String, dynamic> _decodeObject(String responseBody) {
    final decoded = jsonDecode(responseBody);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw const BotConfigurationCenterApiException(
      'Se esperaba un objeto JSON desde el backend.',
    );
  }

  List<dynamic> _decodeList(String responseBody) {
    final decoded = jsonDecode(responseBody);
    if (decoded is List<dynamic>) {
      return decoded;
    }

    throw const BotConfigurationCenterApiException(
      'Se esperaba una lista JSON desde el backend.',
    );
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
