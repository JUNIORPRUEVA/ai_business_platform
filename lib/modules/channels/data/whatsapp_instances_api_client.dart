import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/app_backend_config.dart';

class WhatsappInstancesApiException implements Exception {
  const WhatsappInstancesApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class WhatsappInstancesApiClient {
  WhatsappInstancesApiClient({
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

  Future<List<Map<String, dynamic>>> listInstances(String token) async {
    final response = await _send(
      () => _client.get(
        _buildUri('/whatsapp/instances'),
        headers: _authorizedHeaders(token),
      ),
    );

    final decoded = jsonDecode(response.body);
    if (decoded is List) {
      return decoded
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList(growable: false);
    }

    throw const WhatsappInstancesApiException('Respuesta inválida del backend.');
  }

  Future<Map<String, dynamic>> createInstance({
    required String token,
    required String instanceName,
  }) async {
    final response = await _send(
      () => _client.post(
        _buildUri('/whatsapp/create-instance'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({'instanceName': instanceName}),
      ),
    );

    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> getQr({
    required String token,
    required String instanceName,
  }) async {
    final response = await _send(
      () => _client.get(
        _buildUri('/whatsapp/qr/${Uri.encodeComponent(instanceName)}'),
        headers: _authorizedHeaders(token),
      ),
    );

    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> getStatus({
    required String token,
    required String instanceName,
  }) async {
    final response = await _send(
      () => _client.get(
        _buildUri('/whatsapp/status/${Uri.encodeComponent(instanceName)}'),
        headers: _authorizedHeaders(token),
      ),
    );

    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> logout({
    required String token,
    required String instanceName,
  }) async {
    final response = await _send(
      () => _client.post(
        _buildUri('/whatsapp/logout'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({'instanceName': instanceName}),
      ),
    );

    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> updateInstance({
    required String token,
    required String instanceName,
    required String newInstanceName,
  }) async {
    final response = await _send(
      () => _client.patch(
        _buildUri('/whatsapp/instances/${Uri.encodeComponent(instanceName)}'),
        headers: _authorizedHeaders(token),
        body: jsonEncode({'newInstanceName': newInstanceName}),
      ),
    );

    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> deleteInstance({
    required String token,
    required String instanceName,
  }) async {
    final response = await _send(
      () => _client.delete(
        _buildUri('/whatsapp/instances/${Uri.encodeComponent(instanceName)}'),
        headers: _authorizedHeaders(token),
      ),
    );

    return _decodeObject(response.body);
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
      throw WhatsappInstancesApiException(message, statusCode: response.statusCode);
    } on TimeoutException {
      throw const WhatsappInstancesApiException('La solicitud tardó demasiado.');
    } on http.ClientException catch (error) {
      throw WhatsappInstancesApiException('No se pudo conectar al backend: ${error.message}');
    }
  }

  Map<String, dynamic> _decodeObject(String source) {
    final decoded = jsonDecode(source);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    throw const WhatsappInstancesApiException('Respuesta JSON inválida del backend.');
  }

  String? _extractError(String source) {
    final trimmed = source.trimLeft();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      return 'El backend devolvió HTML en lugar de JSON. Verifica APP_BACKEND_URL.';
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
}
