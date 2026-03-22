enum BotConversationStage {
  onboarding,
  qualified,
  negotiation,
  followUp,
  escalated,
}

extension BotConversationStageX on BotConversationStage {
  String get label {
    switch (this) {
      case BotConversationStage.onboarding:
        return 'Incorporación';
      case BotConversationStage.qualified:
        return 'Calificado';
      case BotConversationStage.negotiation:
        return 'Negociación';
      case BotConversationStage.followUp:
        return 'Seguimiento';
      case BotConversationStage.escalated:
        return 'Escalado';
    }
  }
}

class BotConversation {
  const BotConversation({
    required this.id,
    required this.contactName,
    required this.phoneNumber,
    required this.lastMessagePreview,
    required this.unreadCount,
    required this.stage,
    required this.lastUpdated,
    this.profilePictureUrl,
    this.autoReplyEnabled = false,
  });

  final String id;
  final String contactName;
  final String phoneNumber;
  final String? profilePictureUrl;
  final bool autoReplyEnabled;
  final String lastMessagePreview;
  final int unreadCount;
  final BotConversationStage stage;
  final DateTime lastUpdated;

  BotConversation copyWith({
    String? profilePictureUrl,
    bool? autoReplyEnabled,
    String? lastMessagePreview,
    int? unreadCount,
    BotConversationStage? stage,
    DateTime? lastUpdated,
  }) {
    return BotConversation(
      id: id,
      contactName: contactName,
      phoneNumber: phoneNumber,
      profilePictureUrl: profilePictureUrl ?? this.profilePictureUrl,
      autoReplyEnabled: autoReplyEnabled ?? this.autoReplyEnabled,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      unreadCount: unreadCount ?? this.unreadCount,
      stage: stage ?? this.stage,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}
