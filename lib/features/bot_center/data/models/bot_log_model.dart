import '../../domain/entities/bot_activity_log.dart';
import 'bot_center_model_parsers.dart';

class BotLogModel {
  const BotLogModel({
    required this.id,
    required this.timestamp,
    required this.eventType,
    required this.summary,
    required this.severity,
    this.conversationId,
  });

  factory BotLogModel.fromJson(Map<String, dynamic> json) {
    return BotLogModel(
      id: parseString(json['id']),
      timestamp: parseDateTime(json['timestamp']),
      eventType: parseString(json['eventType']),
      summary: parseString(json['summary']),
      severity: parseLogSeverity(parseString(json['severity'])),
      conversationId: parseString(json['conversationId'], fallback: '').isEmpty
          ? null
          : parseString(json['conversationId']),
    );
  }

  final String id;
  final DateTime timestamp;
  final String eventType;
  final String summary;
  final BotLogSeverity severity;
  final String? conversationId;

  BotActivityLog toEntity() {
    return BotActivityLog(
      id: id,
      timestamp: timestamp,
      eventType: eventType,
      summary: summary,
      severity: severity,
      conversationId: conversationId,
    );
  }
}
