enum BotMessageAuthor {
  contact,
  bot,
  operator,
  system,
}

enum BotMessageState {
  queued,
  sent,
  delivered,
  read,
}

class BotMessage {
  const BotMessage({
    required this.id,
    required this.conversationId,
    required this.author,
    required this.body,
    required this.timestamp,
    required this.state,
  });

  final String id;
  final String conversationId;
  final BotMessageAuthor author;
  final String body;
  final DateTime timestamp;
  final BotMessageState state;

  bool get isIncoming => author == BotMessageAuthor.contact;
}
