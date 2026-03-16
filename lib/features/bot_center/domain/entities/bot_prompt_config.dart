class BotPromptConfig {
  const BotPromptConfig({
    required this.title,
    required this.description,
    required this.content,
    required this.lastUpdated,
  });

  final String title;
  final String description;
  final String content;
  final DateTime lastUpdated;

  BotPromptConfig copyWith({
    String? title,
    String? description,
    String? content,
    DateTime? lastUpdated,
  }) {
    return BotPromptConfig(
      title: title ?? this.title,
      description: description ?? this.description,
      content: content ?? this.content,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}
