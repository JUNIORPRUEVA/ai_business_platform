import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

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
    Duration timeout = const Duration(seconds: 15),
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ??
            const String.fromEnvironment('BOT_CENTER_API_BASE_URL',
                defaultValue: ''),
        _timeout = timeout;

  final http.Client _client;
  final String _baseUrl;
  final Duration _timeout;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      () => _client.get(_buildUri(path, queryParameters), headers: _headers),
    );
    return _decodeObject(response.body);
  }

  Future<List<dynamic>> getJsonList(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      () => _client.get(_buildUri(path, queryParameters), headers: _headers),
    );
    return _decodeList(response.body);
  }

  Future<Map<String, dynamic>> putJson(
      String path, Map<String, dynamic> body) async {
    final response = await _send(
      () => _client.put(
        _buildUri(path),
        headers: _headers,
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Future<Map<String, dynamic>> postJson(
      String path, Map<String, dynamic> body) async {
    final response = await _send(
      () => _client.post(
        _buildUri(path),
        headers: _headers,
        body: jsonEncode(body),
      ),
    );
    return _decodeObject(response.body);
  }

  Map<String, String> get _headers => const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Uri _buildUri(String path, [Map<String, String>? queryParameters]) {
    if (_baseUrl.trim().isEmpty) {
      throw const BotCenterApiException(
        'BOT_CENTER_API_BASE_URL is not configured. Set it with --dart-define before using the live API.',
      );
    }

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
          'Bot Center request failed with status ${response.statusCode}.',
          statusCode: response.statusCode,
        );
      }

      return response;
    } on TimeoutException {
      throw const BotCenterApiException('The Bot Center request timed out.');
    } on http.ClientException catch (error) {
      throw BotCenterApiException(
          'Unable to reach Bot Center backend: ${error.message}');
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
}
