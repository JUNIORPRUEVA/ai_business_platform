import 'bot_message_model.dart';
import 'bot_center_model_parsers.dart';

class BotTestMessageResultModel {
  const BotTestMessageResultModel({
    required this.success,
    required this.message,
    required this.dispatchedAt,
    required this.status,
    this.outboundMessage,
  });

  factory BotTestMessageResultModel.fromJson(Map<String, dynamic> json) {
    return BotTestMessageResultModel(
      success: parseBool(json['success']),
      message: parseString(json['message']),
      dispatchedAt: parseDateTime(json['dispatchedAt']),
      status: parseString(json['status']),
      outboundMessage: json['outboundMessage'] is Map<String, dynamic>
          ? BotMessageModel.fromJson(
              json['outboundMessage'] as Map<String, dynamic>)
          : json['outboundMessage'] is Map
              ? BotMessageModel.fromJson(
                  Map<String, dynamic>.from(json['outboundMessage'] as Map),
                )
              : null,
    );
  }

  final bool success;
  final String message;
  final DateTime dispatchedAt;
  final String status;
  final BotMessageModel? outboundMessage;
}
