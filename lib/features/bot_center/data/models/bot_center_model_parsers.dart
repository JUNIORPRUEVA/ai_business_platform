import '../../domain/entities/bot_activity_log.dart';
import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_memory_item.dart';
import '../../domain/entities/bot_message.dart';

DateTime parseDateTime(dynamic rawValue) {
  if (rawValue is String && rawValue.isNotEmpty) {
    return DateTime.tryParse(rawValue)?.toLocal() ?? DateTime.now();
  }

  return DateTime.now();
}

String parseString(dynamic rawValue, {String fallback = ''}) {
  if (rawValue is String) {
    return rawValue;
  }

  return fallback;
}

int parseInt(dynamic rawValue, {int fallback = 0}) {
  if (rawValue is int) {
    return rawValue;
  }

  if (rawValue is String) {
    return int.tryParse(rawValue) ?? fallback;
  }

  return fallback;
}

bool parseBool(dynamic rawValue, {bool fallback = false}) {
  if (rawValue is bool) {
    return rawValue;
  }

  if (rawValue is String) {
    return rawValue.toLowerCase() == 'true';
  }

  return fallback;
}

List<String> parseStringList(dynamic rawValue) {
  if (rawValue is List) {
    return rawValue.whereType<String>().toList(growable: false);
  }

  return const <String>[];
}

BotConversationStage parseConversationStage(String rawValue) {
  switch (rawValue) {
    case 'onboarding':
      return BotConversationStage.onboarding;
    case 'qualified':
      return BotConversationStage.qualified;
    case 'negotiation':
      return BotConversationStage.negotiation;
    case 'follow_up':
    case 'followUp':
      return BotConversationStage.followUp;
    case 'escalated':
      return BotConversationStage.escalated;
    default:
      return BotConversationStage.onboarding;
  }
}

BotMessageAuthor parseMessageAuthor(String rawValue) {
  switch (rawValue) {
    case 'contact':
      return BotMessageAuthor.contact;
    case 'bot':
      return BotMessageAuthor.bot;
    case 'operator':
      return BotMessageAuthor.operator;
    case 'system':
      return BotMessageAuthor.system;
    default:
      return BotMessageAuthor.system;
  }
}

BotMessageState parseMessageState(String rawValue) {
  switch (rawValue) {
    case 'queued':
      return BotMessageState.queued;
    case 'sent':
      return BotMessageState.sent;
    case 'delivered':
      return BotMessageState.delivered;
    case 'read':
      return BotMessageState.read;
    default:
      return BotMessageState.sent;
  }
}

BotMemoryType parseMemoryType(String rawValue) {
  switch (rawValue) {
    case 'shortTerm':
      return BotMemoryType.shortTerm;
    case 'longTerm':
      return BotMemoryType.longTerm;
    case 'operational':
      return BotMemoryType.operational;
    default:
      return BotMemoryType.shortTerm;
  }
}

BotLogSeverity parseLogSeverity(String rawValue) {
  switch (rawValue) {
    case 'info':
      return BotLogSeverity.info;
    case 'warning':
      return BotLogSeverity.warning;
    case 'critical':
      return BotLogSeverity.critical;
    default:
      return BotLogSeverity.info;
  }
}
