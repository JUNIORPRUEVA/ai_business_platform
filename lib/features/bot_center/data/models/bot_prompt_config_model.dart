import '../../domain/entities/bot_prompt_config.dart';
import 'bot_center_model_parsers.dart';

class BotPromptConfigModel {
  const BotPromptConfigModel({
    required this.id,
    required this.title,
    required this.description,
    required this.content,
    required this.updatedAt,
  });

  factory BotPromptConfigModel.fromJson(Map<String, dynamic> json) {
    return BotPromptConfigModel(
      id: parseString(json['id']),
      title: parseString(json['title']),
      description: parseString(json['description']),
      content: parseString(json['content']),
      updatedAt: parseDateTime(json['updatedAt']),
    );
  }

  final String id;
  final String title;
  final String description;
  final String content;
  final DateTime updatedAt;

  BotPromptConfig toEntity() {
    return BotPromptConfig(
      title: title,
      description: description,
      content: content,
      lastUpdated: updatedAt,
    );
  }
}
