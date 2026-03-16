import '../../domain/entities/bot_tool.dart';
import 'bot_center_model_parsers.dart';

class BotToolModel {
  const BotToolModel({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.active,
  });

  factory BotToolModel.fromJson(Map<String, dynamic> json) {
    return BotToolModel(
      id: parseString(json['id']),
      name: parseString(json['name']),
      description: parseString(json['description']),
      category: parseString(json['category']),
      active: parseBool(json['active']),
    );
  }

  final String id;
  final String name;
  final String description;
  final String category;
  final bool active;

  BotTool toEntity() {
    return BotTool(
      id: id,
      name: name,
      description: description,
      category: category,
      isActive: active,
    );
  }
}
