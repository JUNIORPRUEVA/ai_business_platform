import '../../domain/entities/bot_ai_process_result.dart';
import '../../domain/entities/bot_activity_log.dart';
import '../../domain/entities/bot_center_overview.dart';
import '../../domain/entities/bot_contact_context.dart';
import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_memory_item.dart';
import '../../domain/entities/bot_message.dart';
import '../../domain/entities/bot_prompt_config.dart';
import '../../domain/entities/bot_realtime_event.dart';
import '../../domain/entities/bot_service_status.dart';
import '../../domain/entities/bot_tool.dart';
import '../../domain/repositories/bot_center_repository.dart';
import '../datasources/bot_center_remote_datasource.dart';
import '../datasources/bot_center_seed_datasource.dart';
import '../services/bot_center_api_client.dart';

class BotCenterRepositoryImpl implements BotCenterRepository {
  BotCenterRepositoryImpl({
    required BotCenterRemoteDataSource remoteDataSource,
    BotCenterSeedDataSource? seedDataSource,
    bool enableSeedFallback = false,
  })  : _remoteDataSource = remoteDataSource,
        _seedDataSource = seedDataSource,
        _enableSeedFallback = enableSeedFallback;

  factory BotCenterRepositoryImpl.createDefault({
    String? baseUrl,
    Future<String?> Function()? tokenReader,
  }) {
    return BotCenterRepositoryImpl(
      remoteDataSource: BotCenterRemoteDataSource(
        BotCenterApiClient(baseUrl: baseUrl, tokenReader: tokenReader),
      ),
      seedDataSource: BotCenterSeedDataSource(),
      enableSeedFallback: false,
    );
  }

  final BotCenterRemoteDataSource _remoteDataSource;
  final BotCenterSeedDataSource? _seedDataSource;
  final bool _enableSeedFallback;

  @override
  Future<BotCenterOverview> getOverview({String? conversationId}) async {
    final model = await _resolve(
      () => _remoteDataSource.getOverview(conversationId: conversationId),
      fallback: () =>
          _seedDataSource!.getOverview(conversationId: conversationId),
    );
    return model.toEntity();
  }

  @override
  Future<List<BotConversation>> getConversations() async {
    final models = await _resolve(
      _remoteDataSource.getConversations,
      fallback: _seedDataSource!.getConversations,
    );
    return models.map((item) => item.toEntity()).toList(growable: false);
  }

  @override
  Stream<BotRealtimeEvent> connectRealtime() {
    if (_enableSeedFallback && _seedDataSource != null) {
      return const Stream<BotRealtimeEvent>.empty();
    }

    return _remoteDataSource.connectRealtime().map((item) => item.toEntity());
  }

  @override
  Future<BotContactContext> getContactContext(String conversationId) async {
    final model = await _resolve(
      () => _remoteDataSource.getContactContext(conversationId),
      fallback: () => _seedDataSource!.getContactContext(conversationId),
    );
    return model.toEntity();
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    await _resolve(
      () => _remoteDataSource.deleteConversation(conversationId),
      fallback: () => throw const BotCenterApiException(
        'La eliminaciÃ³n del contacto requiere el backend real del Bot Center.',
      ),
    );
  }

  @override
  Future<List<BotMemoryItem>> getMemory(String conversationId) async {
    final model = await _resolve(
      () => _remoteDataSource.getMemory(conversationId),
      fallback: () => _seedDataSource!.getMemory(conversationId),
    );
    return model.toEntityList();
  }

  @override
  Future<BotMemoryItem> createMemory({
    required String conversationId,
    required String title,
    required String content,
    required BotMemoryType type,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.createMemory(
        conversationId: conversationId,
        title: title,
        content: content,
        type: _memoryTypeToApi(type),
      ),
      fallback: () => throw const BotCenterApiException(
        'La memoria manual requiere el backend real del Bot Center.',
      ),
    );

    return model.toEntity();
  }

  @override
  Future<BotMemoryItem> updateMemory({
    required String conversationId,
    required String memoryId,
    required String title,
    required String content,
    required BotMemoryType type,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.updateMemory(
        conversationId: conversationId,
        memoryId: memoryId,
        title: title,
        content: content,
        type: _memoryTypeToApi(type),
      ),
      fallback: () => throw const BotCenterApiException(
        'La edición de memoria requiere el backend real del Bot Center.',
      ),
    );

    return model.toEntity();
  }

  @override
  Future<void> deleteMemory({
    required String conversationId,
    required String memoryId,
  }) async {
    await _resolve(
      () => _remoteDataSource.deleteMemory(
        conversationId: conversationId,
        memoryId: memoryId,
      ),
      fallback: () => throw const BotCenterApiException(
        'La eliminación de memoria requiere el backend real del Bot Center.',
      ),
    );
  }

  @override
  Future<List<BotMessage>> getMessages(String conversationId) async {
    final models = await _resolve(
      () => _remoteDataSource.getMessages(conversationId),
      fallback: () => _seedDataSource!.getMessages(conversationId),
    );
    return models.map((item) => item.toEntity()).toList(growable: false);
  }

  @override
  Future<List<BotTool>> getTools() async {
    final models = await _resolve(
      _remoteDataSource.getTools,
      fallback: _seedDataSource!.getTools,
    );
    return models.map((item) => item.toEntity()).toList(growable: false);
  }

  @override
  Future<List<BotActivityLog>> getLogs() async {
    final models = await _resolve(
      _remoteDataSource.getLogs,
      fallback: _seedDataSource!.getLogs,
    );
    return models.map((item) => item.toEntity()).toList(growable: false);
  }

  @override
  Future<List<BotServiceStatus>> getStatus() async {
    final model = await _resolve(
      _remoteDataSource.getStatus,
      fallback: _seedDataSource!.getStatus,
    );
    return model.toEntityList();
  }

  @override
  Future<BotPromptConfig> getPrompt() async {
    final model = await _resolve(
      _remoteDataSource.getPrompt,
      fallback: _seedDataSource!.getPrompt,
    );
    return model.toEntity();
  }

  @override
  Future<BotPromptConfig> updatePrompt({
    String? title,
    String? description,
    required String content,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.updatePrompt(
        title: title,
        description: description,
        content: content,
      ),
      fallback: () => _seedDataSource!.updatePrompt(
        title: title,
        description: description,
        content: content,
      ),
    );
    return model.toEntity();
  }

  @override
  Future<String> sendTestMessage({
    required String conversationId,
    required String message,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.sendTestMessage(
        conversationId: conversationId,
        message: message,
      ),
      fallback: () => _seedDataSource!.sendTestMessage(
        conversationId: conversationId,
        message: message,
      ),
    );

    return model.message;
  }

  @override
  Future<BotMessage> sendMediaMessage({
    required String conversationId,
    required List<int> bytes,
    required String fileName,
    required String mimeType,
    required BotMessageType mediaType,
    String? caption,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.sendMediaMessage(
        conversationId: conversationId,
        bytes: bytes,
        fileName: fileName,
        mimeType: mimeType,
        mediaType: _messageTypeToApi(mediaType),
        caption: caption,
      ),
      fallback: () => throw const BotCenterApiException(
        'El envío de archivos requiere el backend real del Bot Center.',
      ),
    );

    return model.toEntity();
  }

  @override
  Future<BotAiProcessResult> processAiMessage({
    required String conversationId,
    required String message,
  }) async {
    final model = await _resolve(
      () => _remoteDataSource.processAiMessage(
        conversationId: conversationId,
        message: message,
      ),
      fallback: () => _seedDataSource!.processAiMessage(
        conversationId: conversationId,
        message: message,
      ),
    );

    return model.toEntity();
  }

  Future<T> _resolve<T>(
    Future<T> Function() remoteCall, {
    Future<T> Function()? fallback,
  }) async {
    try {
      return await remoteCall();
    } on BotCenterApiException {
      if (_enableSeedFallback && fallback != null && _seedDataSource != null) {
        return fallback();
      }
      rethrow;
    }
  }

  String _memoryTypeToApi(BotMemoryType type) {
    switch (type) {
      case BotMemoryType.shortTerm:
        return 'shortTerm';
      case BotMemoryType.longTerm:
        return 'longTerm';
      case BotMemoryType.operational:
        return 'operational';
    }
  }

  String _messageTypeToApi(BotMessageType type) {
    switch (type) {
      case BotMessageType.image:
        return 'image';
      case BotMessageType.video:
        return 'video';
      default:
        throw const BotCenterApiException(
          'Solo se admiten imágenes y videos en el envío de archivos.',
        );
    }
  }
}
