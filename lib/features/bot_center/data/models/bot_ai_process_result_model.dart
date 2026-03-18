import '../../domain/entities/bot_ai_process_result.dart';
import 'bot_center_model_parsers.dart';

class BotAiProcessResultModel {
  const BotAiProcessResultModel({
    required this.ok,
    required this.queued,
    required this.messageId,
  });

  factory BotAiProcessResultModel.fromJson(Map<String, dynamic> json) {
    return BotAiProcessResultModel(
      ok: parseBool(json['ok']),
      queued: parseBool(json['queued']),
      messageId: parseString(json['messageId']),
    );
  }

  final bool ok;
  final bool queued;
  final String messageId;

  BotAiProcessResult toEntity() {
    return BotAiProcessResult(
      ok: ok,
      queued: queued,
      messageId: messageId,
    );
  }
}
