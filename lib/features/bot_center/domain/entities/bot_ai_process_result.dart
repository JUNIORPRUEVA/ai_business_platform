class BotAiProcessResult {
  const BotAiProcessResult({
    required this.ok,
    required this.queued,
    required this.messageId,
  });

  final bool ok;
  final bool queued;
  final String messageId;
}
