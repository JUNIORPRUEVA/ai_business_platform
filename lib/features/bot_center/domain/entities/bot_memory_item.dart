enum BotMemoryType {
  shortTerm,
  longTerm,
  operational,
}

extension BotMemoryTypeX on BotMemoryType {
  String get label {
    switch (this) {
      case BotMemoryType.shortTerm:
        return 'Corto plazo';
      case BotMemoryType.longTerm:
        return 'Largo plazo';
      case BotMemoryType.operational:
        return 'Operativa';
    }
  }
}

class BotMemoryItem {
  const BotMemoryItem({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.updatedAt,
    this.isEditable = false,
  });

  final String id;
  final String title;
  final String content;
  final BotMemoryType type;
  final DateTime updatedAt;
  final bool isEditable;
}
