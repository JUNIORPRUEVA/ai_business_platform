class GeneralBotConfig {
  const GeneralBotConfig({
    required this.botName,
    required this.defaultLanguage,
    required this.isEnabled,
    required this.environmentLabel,
  });

  final String botName;
  final String defaultLanguage;
  final bool isEnabled;
  final String environmentLabel;

  GeneralBotConfig copyWith({
    String? botName,
    String? defaultLanguage,
    bool? isEnabled,
    String? environmentLabel,
  }) {
    return GeneralBotConfig(
      botName: botName ?? this.botName,
      defaultLanguage: defaultLanguage ?? this.defaultLanguage,
      isEnabled: isEnabled ?? this.isEnabled,
      environmentLabel: environmentLabel ?? this.environmentLabel,
    );
  }
}

class EvolutionApiConfig {
  const EvolutionApiConfig({
    required this.baseUrl,
    required this.instanceName,
    required this.apiKey,
    required this.webhookSecret,
    required this.connectedNumber,
    required this.channelId,
    required this.connectionStatus,
    required this.provisioningStatus,
    required this.provisioningError,
    required this.isEnabled,
  });

  final String baseUrl;
  final String instanceName;
  final String apiKey;
  final String webhookSecret;
  final String connectedNumber;
  final String? channelId;
  final String connectionStatus;
  final String provisioningStatus;
  final String? provisioningError;
  final bool isEnabled;

  EvolutionApiConfig copyWith({
    String? baseUrl,
    String? instanceName,
    String? apiKey,
    String? webhookSecret,
    String? connectedNumber,
    String? channelId,
    String? connectionStatus,
    String? provisioningStatus,
    String? provisioningError,
    bool? isEnabled,
  }) {
    return EvolutionApiConfig(
      baseUrl: baseUrl ?? this.baseUrl,
      instanceName: instanceName ?? this.instanceName,
      apiKey: apiKey ?? this.apiKey,
      webhookSecret: webhookSecret ?? this.webhookSecret,
      connectedNumber: connectedNumber ?? this.connectedNumber,
      channelId: channelId ?? this.channelId,
      connectionStatus: connectionStatus ?? this.connectionStatus,
      provisioningStatus: provisioningStatus ?? this.provisioningStatus,
      provisioningError: provisioningError ?? this.provisioningError,
      isEnabled: isEnabled ?? this.isEnabled,
    );
  }
}

class OpenAiConfig {
  const OpenAiConfig({
    required this.apiKey,
    required this.model,
    required this.temperature,
    required this.maxTokens,
    required this.isEnabled,
    required this.systemPromptPreview,
  });

  final String apiKey;
  final String model;
  final double temperature;
  final int maxTokens;
  final bool isEnabled;
  final String systemPromptPreview;

  OpenAiConfig copyWith({
    String? apiKey,
    String? model,
    double? temperature,
    int? maxTokens,
    bool? isEnabled,
    String? systemPromptPreview,
  }) {
    return OpenAiConfig(
      apiKey: apiKey ?? this.apiKey,
      model: model ?? this.model,
      temperature: temperature ?? this.temperature,
      maxTokens: maxTokens ?? this.maxTokens,
      isEnabled: isEnabled ?? this.isEnabled,
      systemPromptPreview: systemPromptPreview ?? this.systemPromptPreview,
    );
  }
}

class MemorySettingsConfig {
  const MemorySettingsConfig({
    required this.enableShortTermMemory,
    required this.enableLongTermMemory,
    required this.enableOperationalMemory,
    required this.recentMessageWindowSize,
    required this.automaticSummarization,
    required this.memoryTtl,
    required this.useRedis,
    required this.usePostgreSql,
  });

  final bool enableShortTermMemory;
  final bool enableLongTermMemory;
  final bool enableOperationalMemory;
  final int recentMessageWindowSize;
  final bool automaticSummarization;
  final String memoryTtl;
  final bool useRedis;
  final bool usePostgreSql;

  MemorySettingsConfig copyWith({
    bool? enableShortTermMemory,
    bool? enableLongTermMemory,
    bool? enableOperationalMemory,
    int? recentMessageWindowSize,
    bool? automaticSummarization,
    String? memoryTtl,
    bool? useRedis,
    bool? usePostgreSql,
  }) {
    return MemorySettingsConfig(
      enableShortTermMemory:
          enableShortTermMemory ?? this.enableShortTermMemory,
      enableLongTermMemory: enableLongTermMemory ?? this.enableLongTermMemory,
      enableOperationalMemory:
          enableOperationalMemory ?? this.enableOperationalMemory,
      recentMessageWindowSize:
          recentMessageWindowSize ?? this.recentMessageWindowSize,
      automaticSummarization:
          automaticSummarization ?? this.automaticSummarization,
      memoryTtl: memoryTtl ?? this.memoryTtl,
      useRedis: useRedis ?? this.useRedis,
      usePostgreSql: usePostgreSql ?? this.usePostgreSql,
    );
  }
}

class OrchestratorConfig {
  const OrchestratorConfig({
    required this.automaticMode,
    required this.assistedMode,
    required this.enableRoleDetection,
    required this.enableIntentClassification,
    required this.enableToolExecution,
    required this.requireConfirmationForCriticalActions,
    required this.autonomyLevel,
    required this.fallbackStrategy,
  });

  final bool automaticMode;
  final bool assistedMode;
  final bool enableRoleDetection;
  final bool enableIntentClassification;
  final bool enableToolExecution;
  final bool requireConfirmationForCriticalActions;
  final String autonomyLevel;
  final String fallbackStrategy;

  OrchestratorConfig copyWith({
    bool? automaticMode,
    bool? assistedMode,
    bool? enableRoleDetection,
    bool? enableIntentClassification,
    bool? enableToolExecution,
    bool? requireConfirmationForCriticalActions,
    String? autonomyLevel,
    String? fallbackStrategy,
  }) {
    return OrchestratorConfig(
      automaticMode: automaticMode ?? this.automaticMode,
      assistedMode: assistedMode ?? this.assistedMode,
      enableRoleDetection: enableRoleDetection ?? this.enableRoleDetection,
      enableIntentClassification:
          enableIntentClassification ?? this.enableIntentClassification,
      enableToolExecution: enableToolExecution ?? this.enableToolExecution,
      requireConfirmationForCriticalActions:
          requireConfirmationForCriticalActions ??
              this.requireConfirmationForCriticalActions,
      autonomyLevel: autonomyLevel ?? this.autonomyLevel,
      fallbackStrategy: fallbackStrategy ?? this.fallbackStrategy,
    );
  }
}

class PromptTemplateConfig {
  const PromptTemplateConfig({
    required this.id,
    required this.title,
    required this.description,
    required this.content,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String description;
  final String content;
  final DateTime updatedAt;

  PromptTemplateConfig copyWith({
    String? id,
    String? title,
    String? description,
    String? content,
    DateTime? updatedAt,
  }) {
    return PromptTemplateConfig(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      content: content ?? this.content,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class InternalToolConfig {
  const InternalToolConfig({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.isEnabled,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final bool isEnabled;

  InternalToolConfig copyWith({
    String? id,
    String? name,
    String? description,
    String? category,
    bool? isEnabled,
  }) {
    return InternalToolConfig(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      category: category ?? this.category,
      isEnabled: isEnabled ?? this.isEnabled,
    );
  }
}

class KnowledgeDocumentConfig {
  const KnowledgeDocumentConfig({
    required this.id,
    required this.name,
    required this.summary,
    required this.status,
    required this.kind,
    required this.sizeLabel,
    required this.isEnabled,
    required this.chunkCount,
    required this.indexingError,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String summary;
  final String status;
  final String kind;
  final String sizeLabel;
  final bool isEnabled;
  final int? chunkCount;
  final String? indexingError;
  final DateTime? updatedAt;

  KnowledgeDocumentConfig copyWith({
    String? id,
    String? name,
    String? summary,
    String? status,
    String? kind,
    String? sizeLabel,
    bool? isEnabled,
    int? chunkCount,
    String? indexingError,
    DateTime? updatedAt,
  }) {
    return KnowledgeDocumentConfig(
      id: id ?? this.id,
      name: name ?? this.name,
      summary: summary ?? this.summary,
      status: status ?? this.status,
      kind: kind ?? this.kind,
      sizeLabel: sizeLabel ?? this.sizeLabel,
      isEnabled: isEnabled ?? this.isEnabled,
      chunkCount: chunkCount ?? this.chunkCount,
      indexingError: indexingError ?? this.indexingError,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class SecuritySettingsConfig {
  const SecuritySettingsConfig({
    required this.internalApiToken,
    required this.webhookSigningSecret,
    required this.encryptSecrets,
    required this.auditLog,
  });

  final String internalApiToken;
  final String webhookSigningSecret;
  final bool encryptSecrets;
  final bool auditLog;

  SecuritySettingsConfig copyWith({
    String? internalApiToken,
    String? webhookSigningSecret,
    bool? encryptSecrets,
    bool? auditLog,
  }) {
    return SecuritySettingsConfig(
      internalApiToken: internalApiToken ?? this.internalApiToken,
      webhookSigningSecret: webhookSigningSecret ?? this.webhookSigningSecret,
      encryptSecrets: encryptSecrets ?? this.encryptSecrets,
      auditLog: auditLog ?? this.auditLog,
    );
  }
}

class BotConfigurationBundle {
  const BotConfigurationBundle({
    required this.general,
    required this.evolutionApi,
    required this.openAi,
    required this.memory,
    required this.orchestrator,
    required this.prompts,
    required this.tools,
    required this.documents,
    required this.security,
  });

  final GeneralBotConfig general;
  final EvolutionApiConfig evolutionApi;
  final OpenAiConfig openAi;
  final MemorySettingsConfig memory;
  final OrchestratorConfig orchestrator;
  final List<PromptTemplateConfig> prompts;
  final List<InternalToolConfig> tools;
  final List<KnowledgeDocumentConfig> documents;
  final SecuritySettingsConfig security;

  BotConfigurationBundle copyWith({
    GeneralBotConfig? general,
    EvolutionApiConfig? evolutionApi,
    OpenAiConfig? openAi,
    MemorySettingsConfig? memory,
    OrchestratorConfig? orchestrator,
    List<PromptTemplateConfig>? prompts,
    List<InternalToolConfig>? tools,
    List<KnowledgeDocumentConfig>? documents,
    SecuritySettingsConfig? security,
  }) {
    return BotConfigurationBundle(
      general: general ?? this.general,
      evolutionApi: evolutionApi ?? this.evolutionApi,
      openAi: openAi ?? this.openAi,
      memory: memory ?? this.memory,
      orchestrator: orchestrator ?? this.orchestrator,
      prompts: prompts ?? this.prompts,
      tools: tools ?? this.tools,
      documents: documents ?? this.documents,
      security: security ?? this.security,
    );
  }
}
