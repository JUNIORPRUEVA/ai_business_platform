import '../../domain/entities/bot_conversation.dart';
import 'bot_center_model_parsers.dart';

class BotConversationModel {
  const BotConversationModel({
    required this.id,
    required this.contactName,
    required this.phone,
    required this.lastMessagePreview,
    required this.unreadCount,
    required this.stage,
    required this.timestamp,
  });

  factory BotConversationModel.fromJson(Map<String, dynamic> json) {
    return BotConversationModel(
      id: parseString(json['id']),
      contactName: parseString(json['contactName']),
      phone: parseString(json['phone']),
      lastMessagePreview: parseString(json['lastMessagePreview']),
      unreadCount: parseInt(json['unreadCount']),
      stage: parseConversationStage(parseString(json['stage'])),
      timestamp: parseDateTime(json['timestamp']),
    );
  }

  final String id;
  final String contactName;
  final String phone;
  final String lastMessagePreview;
  final int unreadCount;
  final BotConversationStage stage;
  final DateTime timestamp;

  BotConversation toEntity() {
    return BotConversation(
      id: id,
      contactName: contactName,
      phoneNumber: phone,
      lastMessagePreview: lastMessagePreview,
      unreadCount: unreadCount,
      stage: stage,
      lastUpdated: timestamp,
    );
  }
}
