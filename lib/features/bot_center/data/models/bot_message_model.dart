import '../../domain/entities/bot_message.dart';
import 'bot_center_model_parsers.dart';

class BotMessageModel {
  const BotMessageModel({
    required this.id,
    required this.conversationId,
    required this.author,
    required this.body,
    required this.type,
    required this.timestamp,
    required this.state,
    this.caption,
    this.mediaUrl,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
  });

  factory BotMessageModel.fromJson(Map<String, dynamic> json) {
    return BotMessageModel(
      id: parseString(json['id']),
      conversationId: parseString(json['conversationId']),
      author: parseMessageAuthor(parseString(json['author'])),
      body: parseString(json['body']),
      type: parseMessageType(parseString(json['type'] ?? json['messageType'])),
      timestamp: parseDateTime(json['timestamp']),
      state: parseMessageState(parseString(json['state'])),
      caption: parseNullableString(json['caption']),
      mediaUrl: parseNullableString(json['mediaUrl']),
      thumbnailUrl: parseNullableString(json['thumbnailUrl']),
      mimeType: parseNullableString(json['mimeType']),
      fileName: parseNullableString(json['fileName']),
    );
  }

  final String id;
  final String conversationId;
  final BotMessageAuthor author;
  final String body;
  final BotMessageType type;
  final DateTime timestamp;
  final BotMessageState state;
  final String? caption;
  final String? mediaUrl;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;

  BotMessage toEntity() {
    return BotMessage(
      id: id,
      conversationId: conversationId,
      author: author,
      body: body,
      type: type,
      timestamp: timestamp,
      state: state,
      caption: caption,
      mediaUrl: mediaUrl,
      thumbnailUrl: thumbnailUrl,
      mimeType: mimeType,
      fileName: fileName,
    );
  }
}
