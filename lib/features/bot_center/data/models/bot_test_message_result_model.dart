import 'bot_center_model_parsers.dart';

class BotTestMessageResultModel {
  const BotTestMessageResultModel({
    required this.success,
    required this.message,
    required this.dispatchedAt,
    required this.status,
  });

  factory BotTestMessageResultModel.fromJson(Map<String, dynamic> json) {
    return BotTestMessageResultModel(
      success: parseBool(json['success']),
      message: parseString(json['message']),
      dispatchedAt: parseDateTime(json['dispatchedAt']),
      status: parseString(json['status']),
    );
  }

  final bool success;
  final String message;
  final DateTime dispatchedAt;
  final String status;
}
