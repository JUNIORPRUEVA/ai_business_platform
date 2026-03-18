import '../models/bot_ai_process_result_model.dart';
import '../models/bot_center_overview_model.dart';
import '../models/bot_contact_context_model.dart';
import '../models/bot_conversation_model.dart';
import '../models/bot_log_model.dart';
import '../models/bot_memory_item_model.dart';
import '../models/bot_message_model.dart';
import '../models/bot_prompt_config_model.dart';
import '../models/bot_status_model.dart';
import '../models/bot_test_message_result_model.dart';
import '../models/bot_tool_model.dart';
import '../services/bot_center_api_client.dart';

class BotCenterRemoteDataSource {
  const BotCenterRemoteDataSource(this._apiClient);

  final BotCenterApiClient _apiClient;

  Future<BotCenterOverviewModel> getOverview({String? conversationId}) async {
    final json = await _apiClient.getJson(
      '/bot-center/overview',
      queryParameters:
          conversationId == null ? null : {'conversationId': conversationId},
    );

    return BotCenterOverviewModel.fromJson(json);
  }

  Future<List<BotConversationModel>> getConversations() async {
    final json = await _apiClient.getJsonList('/bot-center/conversations');
    return json
        .whereType<Map>()
        .map((item) =>
            BotConversationModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<BotMessageModel>> getMessages(String conversationId) async {
    final json = await _apiClient
        .getJsonList('/bot-center/conversations/$conversationId/messages');
    return json
        .whereType<Map>()
        .map(
            (item) => BotMessageModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<BotContactContextModel> getContactContext(
      String conversationId) async {
    final json = await _apiClient
        .getJson('/bot-center/conversations/$conversationId/context');
    return BotContactContextModel.fromJson(json);
  }

  Future<BotMemoryCollectionModel> getMemory(String conversationId) async {
    final json = await _apiClient
        .getJson('/bot-center/conversations/$conversationId/memory');
    return BotMemoryCollectionModel.fromJson(json);
  }

  Future<BotMemoryItemModel> createMemory({
    required String conversationId,
    required String title,
    required String content,
    required String type,
  }) async {
    final json = await _apiClient.postJson(
      '/bot-center/conversations/$conversationId/memory',
      {
        'title': title,
        'content': content,
        'type': type,
      },
    );
    return BotMemoryItemModel.fromJson(json);
  }

  Future<BotMemoryItemModel> updateMemory({
    required String conversationId,
    required String memoryId,
    required String title,
    required String content,
    required String type,
  }) async {
    final json = await _apiClient.patchJson(
      '/bot-center/conversations/$conversationId/memory/$memoryId',
      {
        'title': title,
        'content': content,
        'type': type,
      },
    );
    return BotMemoryItemModel.fromJson(json);
  }

  Future<void> deleteMemory({
    required String conversationId,
    required String memoryId,
  }) async {
    await _apiClient.deleteJson(
      '/bot-center/conversations/$conversationId/memory/$memoryId',
    );
  }

  Future<List<BotToolModel>> getTools() async {
    final json = await _apiClient.getJsonList('/bot-center/tools');
    return json
        .whereType<Map>()
        .map((item) => BotToolModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<BotLogModel>> getLogs() async {
    final json = await _apiClient.getJsonList('/bot-center/logs');
    return json
        .whereType<Map>()
        .map((item) => BotLogModel.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<BotStatusModel> getStatus() async {
    final json = await _apiClient.getJson('/bot-center/status');
    return BotStatusModel.fromJson(json);
  }

  Future<BotPromptConfigModel> getPrompt() async {
    final json = await _apiClient.getJson('/bot-center/prompt');
    return BotPromptConfigModel.fromJson(json);
  }

  Future<BotPromptConfigModel> updatePrompt({
    String? title,
    String? description,
    required String content,
  }) async {
    final json = await _apiClient.putJson('/bot-center/prompt', {
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      'content': content,
    });
    return BotPromptConfigModel.fromJson(json);
  }

  Future<BotTestMessageResultModel> sendTestMessage({
    required String conversationId,
    required String message,
  }) async {
    final json = await _apiClient.postJson('/bot-center/test-message', {
      'conversationId': conversationId,
      'message': message,
    });

    return BotTestMessageResultModel.fromJson(json);
  }

  Future<BotAiProcessResultModel> processAiMessage({
    required String conversationId,
    required String message,
  }) async {
    final json = await _apiClient.postJson('/ai-brain/process-message', {
      'conversationId': conversationId,
      'message': message,
    });

    return BotAiProcessResultModel.fromJson(json);
  }
}
