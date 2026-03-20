import 'bot_conversation.dart';
import 'bot_message.dart';

class BotRealtimeEvent {
  const BotRealtimeEvent({
    required this.event,
    this.conversation,
    this.message,
  });

  final String event;
  final BotConversation? conversation;
  final BotMessage? message;

  bool get hasMessageUpdate => conversation != null && message != null;
}