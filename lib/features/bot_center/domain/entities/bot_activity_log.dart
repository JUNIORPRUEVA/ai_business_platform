enum BotLogSeverity {
  info,
  warning,
  critical,
}

class BotActivityLog {
  const BotActivityLog({
    required this.id,
    required this.timestamp,
    required this.eventType,
    required this.summary,
    required this.severity,
    this.conversationId,
  });

  final String id;
  final DateTime timestamp;
  final String eventType;
  final String summary;
  final BotLogSeverity severity;
  final String? conversationId;
}
