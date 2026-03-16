class BotServiceStatus {
  const BotServiceStatus({
    required this.title,
    required this.value,
    required this.description,
    required this.isHealthy,
  });

  final String title;
  final String value;
  final String description;
  final bool isHealthy;
}
