import '../../domain/entities/bot_realtime_event.dart';
import 'bot_conversation_model.dart';
import 'bot_message_model.dart';

class BotRealtimeEventModel {
  const BotRealtimeEventModel({
    required this.event,
    this.conversation,
    this.message,
  });

  factory BotRealtimeEventModel.fromEnvelope(Map<String, dynamic> json) {
    final event = (json['event'] as String?)?.trim() ?? 'message';
    final rawData = json['data'];
    final data = rawData is Map<String, dynamic>
        ? rawData
        : rawData is Map
            ? Map<String, dynamic>.from(rawData)
            : const <String, dynamic>{};

    final rawConversation = data['conversation'];
    final rawMessage = data['message'];

    return BotRealtimeEventModel(
      event: event,
      conversation: rawConversation is Map<String, dynamic>
          ? BotConversationModel.fromJson(rawConversation)
          : rawConversation is Map
              ? BotConversationModel.fromJson(Map<String, dynamic>.from(rawConversation))
              : null,
      message: rawMessage is Map<String, dynamic>
          ? BotMessageModel.fromJson(rawMessage)
          : rawMessage is Map
              ? BotMessageModel.fromJson(Map<String, dynamic>.from(rawMessage))
              : null,
    );
  }

  final String event;
  final BotConversationModel? conversation;
  final BotMessageModel? message;

  BotRealtimeEvent toEntity() {
    return BotRealtimeEvent(
      event: event,
      conversation: conversation?.toEntity(),
      message: message?.toEntity(),
    );
  }
}