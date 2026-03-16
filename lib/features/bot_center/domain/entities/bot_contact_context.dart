class BotProductKnowledge {
  const BotProductKnowledge({
    required this.name,
    required this.summary,
    required this.keyCapabilities,
    required this.qualificationSignals,
    required this.cautionPoints,
  });

  final String name;
  final String summary;
  final List<String> keyCapabilities;
  final List<String> qualificationSignals;
  final List<String> cautionPoints;
}

class BotContactContext {
  const BotContactContext({
    required this.name,
    required this.phoneNumber,
    required this.role,
    required this.businessType,
    required this.city,
    required this.tags,
    required this.productKnowledge,
  });

  final String name;
  final String phoneNumber;
  final String role;
  final String businessType;
  final String city;
  final List<String> tags;
  final List<BotProductKnowledge> productKnowledge;
}
