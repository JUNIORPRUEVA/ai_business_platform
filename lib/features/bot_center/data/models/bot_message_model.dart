import '../../domain/entities/bot_message.dart';
import 'bot_center_model_parsers.dart';

class BotMessageModel {
  const BotMessageModel({
    required this.id,
    required this.conversationId,
    required this.author,
    required this.body,
    required this.timestamp,
    required this.state,
  });

  factory BotMessageModel.fromJson(Map<String, dynamic> json) {
    return BotMessageModel(
      id: parseString(json['id']),
      conversationId: parseString(json['conversationId']),
      author: parseMessageAuthor(parseString(json['author'])),
      body: parseString(json['body']),
      timestamp: parseDateTime(json['timestamp']),
      state: parseMessageState(parseString(json['state'])),
    );
  }

  final String id;
  final String conversationId;
  final BotMessageAuthor author;
  final String body;
  final DateTime timestamp;
  final BotMessageState state;

  BotMessage toEntity() {
    return BotMessage(
      id: id,
      conversationId: conversationId,
      author: author,
      body: body,
      timestamp: timestamp,
      state: state,
    );
  }
}
