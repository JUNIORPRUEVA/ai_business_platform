import 'bot_activity_log.dart';
import 'bot_conversation.dart';
import 'bot_conversation_workspace_data.dart';
import 'bot_prompt_config.dart';
import 'bot_service_status.dart';
import 'bot_tool.dart';

class BotCenterOverview {
  const BotCenterOverview({
    required this.conversations,
    required this.tools,
    required this.logs,
    required this.statuses,
    required this.promptConfig,
    this.selectedConversationData,
  });

  final List<BotConversation> conversations;
  final List<BotTool> tools;
  final List<BotActivityLog> logs;
  final List<BotServiceStatus> statuses;
  final BotPromptConfig promptConfig;
  final BotConversationWorkspaceData? selectedConversationData;
}
