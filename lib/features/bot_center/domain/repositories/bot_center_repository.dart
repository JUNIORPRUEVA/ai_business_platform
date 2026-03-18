import '../entities/bot_ai_process_result.dart';
import '../entities/bot_activity_log.dart';
import '../entities/bot_center_overview.dart';
import '../entities/bot_contact_context.dart';
import '../entities/bot_conversation.dart';
import '../entities/bot_memory_item.dart';
import '../entities/bot_message.dart';
import '../entities/bot_prompt_config.dart';
import '../entities/bot_service_status.dart';
import '../entities/bot_tool.dart';

abstract interface class BotCenterRepository {
  Future<BotCenterOverview> getOverview({String? conversationId});

  Future<List<BotConversation>> getConversations();

  Future<List<BotMessage>> getMessages(String conversationId);

  Future<BotContactContext> getContactContext(String conversationId);

  Future<List<BotMemoryItem>> getMemory(String conversationId);

  Future<BotMemoryItem> createMemory({
    required String conversationId,
    required String title,
    required String content,
    required BotMemoryType type,
  });

  Future<BotMemoryItem> updateMemory({
    required String conversationId,
    required String memoryId,
    required String title,
    required String content,
    required BotMemoryType type,
  });

  Future<void> deleteMemory({
    required String conversationId,
    required String memoryId,
  });

  Future<List<BotTool>> getTools();

  Future<List<BotActivityLog>> getLogs();

  Future<List<BotServiceStatus>> getStatus();

  Future<BotPromptConfig> getPrompt();

  Future<BotPromptConfig> updatePrompt({
    String? title,
    String? description,
    required String content,
  });

  Future<String> sendTestMessage({
    required String conversationId,
    required String message,
  });

  Future<BotAiProcessResult> processAiMessage({
    required String conversationId,
    required String message,
  });
}
