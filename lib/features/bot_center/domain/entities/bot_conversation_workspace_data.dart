import 'bot_contact_context.dart';
import 'bot_conversation.dart';
import 'bot_memory_item.dart';
import 'bot_message.dart';

class BotConversationWorkspaceData {
  const BotConversationWorkspaceData({
    required this.conversation,
    required this.messages,
    required this.contact,
    required this.memoryItems,
  });

  final BotConversation conversation;
  final List<BotMessage> messages;
  final BotContactContext contact;
  final List<BotMemoryItem> memoryItems;
}
