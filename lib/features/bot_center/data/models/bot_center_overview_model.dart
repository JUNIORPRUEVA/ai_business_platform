import '../../domain/entities/bot_center_overview.dart';
import '../../domain/entities/bot_conversation_workspace_data.dart';
import 'bot_contact_context_model.dart';
import 'bot_conversation_model.dart';
import 'bot_log_model.dart';
import 'bot_memory_item_model.dart';
import 'bot_message_model.dart';
import 'bot_prompt_config_model.dart';
import 'bot_status_model.dart';
import 'bot_tool_model.dart';

class BotSelectedConversationModel {
  const BotSelectedConversationModel({
    required this.conversation,
    required this.messages,
    required this.context,
    required this.memory,
  });

  factory BotSelectedConversationModel.fromJson(Map<String, dynamic> json) {
    final rawMessages = (json['messages'] as List?) ?? const <dynamic>[];

    return BotSelectedConversationModel(
      conversation: BotConversationModel.fromJson(
        Map<String, dynamic>.from(
            json['conversation'] as Map? ?? const <String, dynamic>{}),
      ),
      messages: rawMessages
          .whereType<Map>()
          .map((item) =>
              BotMessageModel.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      context: BotContactContextModel.fromJson(
        Map<String, dynamic>.from(
            json['context'] as Map? ?? const <String, dynamic>{}),
      ),
      memory: BotMemoryCollectionModel.fromJson(
        Map<String, dynamic>.from(
            json['memory'] as Map? ?? const <String, dynamic>{}),
      ),
    );
  }

  final BotConversationModel conversation;
  final List<BotMessageModel> messages;
  final BotContactContextModel context;
  final BotMemoryCollectionModel memory;

  BotConversationWorkspaceData toEntity() {
    return BotConversationWorkspaceData(
      conversation: conversation.toEntity(),
      messages: messages.map((item) => item.toEntity()).toList(growable: false),
      contact: context.toEntity(),
      memoryItems: memory.toEntityList(),
    );
  }
}

class BotCenterOverviewModel {
  const BotCenterOverviewModel({
    required this.conversations,
    required this.tools,
    required this.logs,
    required this.status,
    required this.prompt,
    this.selectedConversation,
  });

  factory BotCenterOverviewModel.fromJson(Map<String, dynamic> json) {
    final rawConversations =
        (json['conversations'] as List?) ?? const <dynamic>[];
    final rawTools = (json['tools'] as List?) ?? const <dynamic>[];
    final rawLogs = (json['logs'] as List?) ?? const <dynamic>[];

    return BotCenterOverviewModel(
      conversations: rawConversations
          .whereType<Map>()
          .map((item) =>
              BotConversationModel.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      tools: rawTools
          .whereType<Map>()
          .map((item) => BotToolModel.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      logs: rawLogs
          .whereType<Map>()
          .map((item) => BotLogModel.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      status: BotStatusModel.fromJson(
        Map<String, dynamic>.from(
            json['status'] as Map? ?? const <String, dynamic>{}),
      ),
      prompt: BotPromptConfigModel.fromJson(
        Map<String, dynamic>.from(
            json['prompt'] as Map? ?? const <String, dynamic>{}),
      ),
      selectedConversation: json['selectedConversation'] is Map
          ? BotSelectedConversationModel.fromJson(
              Map<String, dynamic>.from(json['selectedConversation'] as Map),
            )
          : null,
    );
  }

  final List<BotConversationModel> conversations;
  final List<BotToolModel> tools;
  final List<BotLogModel> logs;
  final BotStatusModel status;
  final BotPromptConfigModel prompt;
  final BotSelectedConversationModel? selectedConversation;

  BotCenterOverview toEntity() {
    return BotCenterOverview(
      conversations:
          conversations.map((item) => item.toEntity()).toList(growable: false),
      tools: tools.map((item) => item.toEntity()).toList(growable: false),
      logs: logs.map((item) => item.toEntity()).toList(growable: false),
      statuses: status.toEntityList(),
      promptConfig: prompt.toEntity(),
      selectedConversationData: selectedConversation?.toEntity(),
    );
  }
}
