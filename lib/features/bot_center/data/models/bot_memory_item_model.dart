import '../../domain/entities/bot_memory_item.dart';
import 'bot_center_model_parsers.dart';

class BotMemoryItemModel {
  const BotMemoryItemModel({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.updatedAt,
    required this.isEditable,
  });

  factory BotMemoryItemModel.fromJson(Map<String, dynamic> json) {
    return BotMemoryItemModel(
      id: parseString(json['id']),
      title: parseString(json['title']),
      content: parseString(json['content']),
      type: parseMemoryType(parseString(json['type'])),
      updatedAt: parseDateTime(json['updatedAt']),
      isEditable: json['isEditable'] == true,
    );
  }

  final String id;
  final String title;
  final String content;
  final BotMemoryType type;
  final DateTime updatedAt;
  final bool isEditable;

  BotMemoryItem toEntity() {
    return BotMemoryItem(
      id: id,
      title: title,
      content: content,
      type: type,
      updatedAt: updatedAt,
      isEditable: isEditable,
    );
  }
}

class BotMemoryCollectionModel {
  const BotMemoryCollectionModel({
    required this.shortTerm,
    required this.longTerm,
    required this.operational,
  });

  factory BotMemoryCollectionModel.fromJson(Map<String, dynamic> json) {
    List<BotMemoryItemModel> parseList(dynamic rawValue) {
      if (rawValue is List) {
        return rawValue
            .whereType<Map>()
            .map((item) =>
                BotMemoryItemModel.fromJson(Map<String, dynamic>.from(item)))
            .toList(growable: false);
      }

      return const <BotMemoryItemModel>[];
    }

    return BotMemoryCollectionModel(
      shortTerm: parseList(json['shortTerm']),
      longTerm: parseList(json['longTerm']),
      operational: parseList(json['operational']),
    );
  }

  final List<BotMemoryItemModel> shortTerm;
  final List<BotMemoryItemModel> longTerm;
  final List<BotMemoryItemModel> operational;

  List<BotMemoryItem> toEntityList() {
    return [
      ...shortTerm.map((item) => item.toEntity()),
      ...longTerm.map((item) => item.toEntity()),
      ...operational.map((item) => item.toEntity()),
    ];
  }
}
