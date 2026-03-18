import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/config/app_backend_config.dart';

class BotCenterApiException implements Exception {
  const BotCenterApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class BotCenterApiClient {
  BotCenterApiClient({
    http.Client? client,
    String? baseUrl,
    Future<String?> Function()? tokenReader,
    Duration timeout = const Duration(seconds: 15),
  })  : _client = client ?? http.Client(),
        _baseUrl = resolveBackendUrl(
          preferred: baseUrl,
          fallback: const String.fromEnvironment(
            'BOT_CENTER_API_BASE_URL',
            defaultValue: String.fromEnvironment('APP_BACKEND_URL'),
          ),
        ),
        _tokenReader = tokenReader,
        _timeout = timeout;

  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? _tokenReader;
  final Duration _timeout;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.get(_buildUri(path, queryParameters), headers: headers),
    );
    return _decodeObject(response.body);
  }

  Future<List<dynamic>> getJsonList(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.get(_buildUri(path, queryParameters), headers: headers),
    );
    return _decodeList(response.body);
  }

  Future<Map<String, dynamic>> putJson(
      String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.put(
        _buildUri(path),
        headers: headers,
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> postJson(
      String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.post(
        _buildUri(path),
        headers: headers,
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> patchJson(
      String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.patch(
        _buildUri(path),
        headers: headers,
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> deleteJson(String path) async {
    final headers = await _headers();
    final response = await _send(
      () => _client.delete(
        _buildUri(path),
        headers: headers,
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, String>> _headers() async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    final token = await _tokenReader?.call();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

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

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw BotCenterApiException(
          _extractError(response.body) ??
              'Bot Center request failed with status ${response.statusCode}. Backend=$_baseUrl',
          statusCode: response.statusCode,
        );
      }

      return response;
    } on TimeoutException {
      throw BotCenterApiException(
        'The Bot Center request timed out. Backend=$_baseUrl',
      );
    } on http.ClientException catch (error) {
      throw BotCenterApiException(
          'Unable to reach Bot Center backend: ${error.message}. Backend=$_baseUrl');
    }
  }

  Map<String, dynamic> _decodeObject(String responseBody) {
    final decoded = jsonDecode(responseBody);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw const BotCenterApiException(
        'Expected a JSON object from the Bot Center backend.');
  }

  List<dynamic> _decodeList(String responseBody) {
    final decoded = jsonDecode(responseBody);
    if (decoded is List<dynamic>) {
      return decoded;
    }

    throw const BotCenterApiException(
        'Expected a JSON list from the Bot Center backend.');
  }

  String? _extractError(String source) {
    final trimmed = source.trimLeft();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      return 'El backend devolvio HTML en lugar de JSON. Verifica la URL configurada.';
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
