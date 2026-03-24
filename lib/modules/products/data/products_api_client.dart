import 'package:file_picker/file_picker.dart';

import '../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';

class ProductsApiClient {
  ProductsApiClient({BotConfigurationCenterApiClient? apiClient})
      : _apiClient = apiClient ?? BotConfigurationCenterApiClient();

  final BotConfigurationCenterApiClient _apiClient;

  Future<List<ProductRecord>> list(String token) async {
    final response = await _apiClient.getJsonList('/products', token: token);
    return response
        .whereType<Map>()
        .map((entry) => ProductRecord.fromJson(entry.cast<String, dynamic>()))
        .toList(growable: false);
  }

  Future<void> create(String token, Map<String, dynamic> payload) {
    return _apiClient.postJson('/products', payload, token: token);
  }

  Future<void> update(String token, String productId, Map<String, dynamic> payload) {
    return _apiClient.patchJson('/products/$productId', payload, token: token);
  }

  Future<void> delete(String token, String productId) {
    return _apiClient.delete('/products/$productId', token: token);
  }

  Future<Map<String, dynamic>> importCsv(
    String token, {
    required String csvText,
  }) {
    return _apiClient.postJson(
      '/products/import',
      {
        'csvText': csvText,
        'replaceExisting': true,
      },
      token: token,
    );
  }

  Future<void> uploadImage({
    required String token,
    required String productId,
    required PlatformFile file,
    required int sortOrder,
    String? altText,
  }) async {
    final bytes = file.bytes;
    if (bytes == null) {
      throw const BotConfigurationCenterApiException(
        'No se pudieron leer los bytes de la imagen seleccionada.',
      );
    }

    final contentType = _resolveContentType(file.extension, fallback: 'image/jpeg');
    final uploadTarget = await _apiClient.postJson(
      '/products/media/presign-upload',
      {
        'filename': file.name,
        'contentType': contentType,
      },
      token: token,
    );

    await _apiClient.uploadBytesToUrl(
      url: uploadTarget['url'] as String,
      bytes: bytes,
      contentType: contentType,
    );

    await _apiClient.postJson(
      '/products/$productId/images',
      {
        'storageKey': uploadTarget['key'] as String,
        'fileName': file.name,
        'contentType': contentType,
        'altText': altText,
        'sortOrder': sortOrder,
      },
      token: token,
    );
  }

  Future<void> uploadVideo({
    required String token,
    required String productId,
    required PlatformFile file,
    required String title,
    String? description,
    required int sortOrder,
  }) async {
    final bytes = file.bytes;
    if (bytes == null) {
      throw const BotConfigurationCenterApiException(
        'No se pudieron leer los bytes del video seleccionado.',
      );
    }

    final contentType = _resolveContentType(file.extension, fallback: 'video/mp4');
    final uploadTarget = await _apiClient.postJson(
      '/products/media/presign-upload',
      {
        'filename': file.name,
        'contentType': contentType,
      },
      token: token,
    );

    await _apiClient.uploadBytesToUrl(
      url: uploadTarget['url'] as String,
      bytes: bytes,
      contentType: contentType,
    );

    await _apiClient.postJson(
      '/products/$productId/videos',
      {
        'title': title,
        'description': description,
        'storageKey': uploadTarget['key'] as String,
        'fileName': file.name,
        'contentType': contentType,
        'sortOrder': sortOrder,
      },
      token: token,
    );
  }

  Future<void> deleteImage(String token, String productId, String mediaId) {
    return _apiClient.delete('/products/$productId/images/$mediaId', token: token);
  }

  Future<void> deleteVideo(String token, String productId, String mediaId) {
    return _apiClient.delete('/products/$productId/videos/$mediaId', token: token);
  }

  Future<String?> resolveDownloadUrl(String token, String storageKey) async {
    final response = await _apiClient.getJson(
      '/storage/presign-download',
      token: token,
      queryParameters: {'key': storageKey},
    );
    final url = response['url'];
    if (url is String && url.trim().isNotEmpty) {
      return url.trim();
    }
    return null;
  }

  static String resolveContentType(String? extension, {required String fallback}) {
    return _resolveContentType(extension, fallback: fallback);
  }
}

class ProductRecord {
  const ProductRecord({
    required this.id,
    required this.identifier,
    required this.name,
    required this.salesPrice,
    required this.currency,
    required this.negotiationAllowed,
    required this.active,
    required this.images,
    required this.videos,
    this.description,
    this.offerPrice,
    this.discountPercent,
    this.negotiationMarginPercent,
    this.category,
    this.brand,
    this.benefits,
    this.availabilityText,
    this.stockQuantity,
    this.lowStockThreshold,
    this.tags = const [],
  });

  factory ProductRecord.fromJson(Map<String, dynamic> json) {
    return ProductRecord(
      id: _asString(json['id']),
      identifier: _asString(json['identifier']),
      name: _asString(json['name']),
      description: _asNullableString(json['description']),
      salesPrice: _asString(json['salesPrice']),
      offerPrice: _asNullableString(json['offerPrice']),
      discountPercent: _asNullableString(json['discountPercent']),
      negotiationAllowed: json['negotiationAllowed'] == true,
      negotiationMarginPercent: _asNullableString(json['negotiationMarginPercent']),
      currency: _asString(json['currency'], fallback: 'DOP'),
      category: _asNullableString(json['category']),
      brand: _asNullableString(json['brand']),
      benefits: _asNullableString(json['benefits']),
      availabilityText: _asNullableString(json['availabilityText']),
      stockQuantity: _asNullableInt(json['stockQuantity']),
      lowStockThreshold: _asNullableInt(json['lowStockThreshold']),
      active: json['active'] != false,
      tags: _asStringList(json['tags']),
      images: _asMediaList(json['images']),
      videos: _asVideoList(json['videos']),
    );
  }

  final String id;
  final String identifier;
  final String name;
  final String? description;
  final String salesPrice;
  final String? offerPrice;
  final String? discountPercent;
  final bool negotiationAllowed;
  final String? negotiationMarginPercent;
  final String currency;
  final String? category;
  final String? brand;
  final String? benefits;
  final String? availabilityText;
  final int? stockQuantity;
  final int? lowStockThreshold;
  final bool active;
  final List<String> tags;
  final List<ProductMediaRecord> images;
  final List<ProductVideoRecord> videos;
}

class ProductMediaRecord {
  const ProductMediaRecord({
    required this.id,
    required this.fileName,
    required this.storageKey,
    this.contentType,
  });

  factory ProductMediaRecord.fromJson(Map<String, dynamic> json) {
    return ProductMediaRecord(
      id: _asString(json['id']),
      fileName: _asString(json['fileName']),
      storageKey: _asString(json['storageKey']),
      contentType: _asNullableString(json['contentType']),
    );
  }

  final String id;
  final String fileName;
  final String storageKey;
  final String? contentType;
}

class ProductVideoRecord {
  const ProductVideoRecord({
    required this.id,
    required this.title,
    required this.fileName,
    this.description,
  });

  factory ProductVideoRecord.fromJson(Map<String, dynamic> json) {
    return ProductVideoRecord(
      id: _asString(json['id']),
      title: _asString(json['title']),
      fileName: _asString(json['fileName']),
      description: _asNullableString(json['description']),
    );
  }

  final String id;
  final String title;
  final String fileName;
  final String? description;
}

String _resolveContentType(String? extension, {required String fallback}) {
  switch ((extension ?? '').toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'csv':
      return 'text/csv';
    default:
      return fallback;
  }
}

String _asString(dynamic value, {String fallback = ''}) {
  if (value is String && value.trim().isNotEmpty) {
    return value.trim();
  }
  return fallback;
}

String? _asNullableString(dynamic value) {
  if (value is String && value.trim().isNotEmpty) {
    return value.trim();
  }
  return null;
}

int? _asNullableInt(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String && value.trim().isNotEmpty) {
    return int.tryParse(value.trim());
  }
  return null;
}

List<String> _asStringList(dynamic value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList(growable: false);
  }
  return const [];
}

List<ProductMediaRecord> _asMediaList(dynamic value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((entry) => ProductMediaRecord.fromJson(entry.cast<String, dynamic>()))
        .toList(growable: false);
  }
  return const [];
}

List<ProductVideoRecord> _asVideoList(dynamic value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((entry) => ProductVideoRecord.fromJson(entry.cast<String, dynamic>()))
        .toList(growable: false);
  }
  return const [];
}
