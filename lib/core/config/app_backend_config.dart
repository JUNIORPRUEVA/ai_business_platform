import 'package:flutter/foundation.dart';

const String kDefaultHostedBackendUrl =
    'https://ai-business-platform-backend-ia.onqyr1.easypanel.host';

const String kDefaultLocalBackendUrl = 'http://localhost:3000';

String resolveBackendUrl({
  String? preferred,
  String? fallback,
}) {
  final normalizedPreferred = preferred?.trim();
  if (normalizedPreferred != null && normalizedPreferred.isNotEmpty) {
    return normalizedPreferred;
  }

  final normalizedFallback = fallback?.trim();
  if (normalizedFallback != null && normalizedFallback.isNotEmpty) {
    return normalizedFallback;
  }

  if (kIsWeb) {
    return kDefaultHostedBackendUrl;
  }

  if (kDebugMode) {
    return kDefaultLocalBackendUrl;
  }

  return kDefaultHostedBackendUrl;
}
