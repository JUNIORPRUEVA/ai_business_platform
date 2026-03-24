import '../../domain/entities/bot_configuration_bundle.dart';

class GeneralBotConfigModel {
  const GeneralBotConfigModel({
    required this.botName,
    required this.defaultLanguage,
    required this.isEnabled,
    required this.environmentLabel,
  });

  factory GeneralBotConfigModel.fromJson(Map<String, dynamic> json) {
    return GeneralBotConfigModel(
      botName: json['botName'] as String? ?? '',
      defaultLanguage: json['defaultLanguage'] as String? ?? 'pt-BR',
      isEnabled: json['isEnabled'] as bool? ?? true,
      environmentLabel: json['environmentLabel'] as String? ?? 'Producción',
    );
  }

  final String botName;
  final String defaultLanguage;
  final bool isEnabled;
  final String environmentLabel;

  GeneralBotConfig toEntity() {
    return GeneralBotConfig(
      botName: botName,
      defaultLanguage: defaultLanguage,
      isEnabled: isEnabled,
      environmentLabel: environmentLabel,
    );
  }
}

class EvolutionApiConfigModel {
  const EvolutionApiConfigModel({
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

  factory EvolutionApiConfigModel.fromJson(Map<String, dynamic> json) {
    return EvolutionApiConfigModel(
      baseUrl: json['baseUrl'] as String? ?? '',
      instanceName: json['instanceName'] as String? ?? '',
      apiKey: json['apiKey'] as String? ?? '',
      webhookSecret: json['webhookSecret'] as String? ?? '',
      connectedNumber: json['connectedNumber'] as String? ?? '',
      channelId: json['channelId'] as String?,
      connectionStatus: json['connectionStatus'] as String? ?? 'disconnected',
      provisioningStatus: json['provisioningStatus'] as String? ?? 'idle',
      provisioningError: json['provisioningError'] as String?,
      isEnabled: json['isEnabled'] as bool? ?? false,
    );
  }

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

  EvolutionApiConfig toEntity() {
    return EvolutionApiConfig(
      baseUrl: baseUrl,
      instanceName: instanceName,
      apiKey: apiKey,
      webhookSecret: webhookSecret,
      connectedNumber: connectedNumber,
      channelId: channelId,
      connectionStatus: connectionStatus,
      provisioningStatus: provisioningStatus,
      provisioningError: provisioningError,
      isEnabled: isEnabled,
    );
  }
}

class OpenAiConfigModel {
  const OpenAiConfigModel({
    required this.apiKey,
    required this.model,
    required this.temperature,
    required this.maxTokens,
    required this.isEnabled,
    required this.systemPromptPreview,
  });

  factory OpenAiConfigModel.fromJson(Map<String, dynamic> json) {
    return OpenAiConfigModel(
      apiKey: json['apiKey'] as String? ?? '',
      model: json['model'] as String? ?? 'gpt-5.4-mini',
      temperature: (json['temperature'] as num?)?.toDouble() ?? 0.2,
      maxTokens: json['maxTokens'] as int? ?? 1200,
      isEnabled: json['isEnabled'] as bool? ?? true,
      systemPromptPreview: json['systemPromptPreview'] as String? ?? '',
    );
  }

  final String apiKey;
  final String model;
  final double temperature;
  final int maxTokens;
  final bool isEnabled;
  final String systemPromptPreview;

  OpenAiConfig toEntity() {
    return OpenAiConfig(
      apiKey: apiKey,
      model: model,
      temperature: temperature,
      maxTokens: maxTokens,
      isEnabled: isEnabled,
      systemPromptPreview: systemPromptPreview,
    );
  }
}

class MemorySettingsConfigModel {
  const MemorySettingsConfigModel({
    required this.enableShortTermMemory,
    required this.enableLongTermMemory,
    required this.enableOperationalMemory,
    required this.recentMessageWindowSize,
    required this.automaticSummarization,
    required this.memoryTtl,
    required this.useRedis,
    required this.usePostgreSql,
  });

  factory MemorySettingsConfigModel.fromJson(Map<String, dynamic> json) {
    return MemorySettingsConfigModel(
      enableShortTermMemory: json['enableShortTermMemory'] as bool? ?? true,
      enableLongTermMemory: json['enableLongTermMemory'] as bool? ?? true,
      enableOperationalMemory: json['enableOperationalMemory'] as bool? ?? true,
      recentMessageWindowSize: json['recentMessageWindowSize'] as int? ?? 20,
      automaticSummarization: json['automaticSummarization'] as bool? ?? true,
      memoryTtl: json['memoryTtl'] as String? ?? '30d',
      useRedis: json['useRedis'] as bool? ?? true,
      usePostgreSql: json['usePostgreSql'] as bool? ?? true,
    );
  }

  final bool enableShortTermMemory;
  final bool enableLongTermMemory;
  final bool enableOperationalMemory;
  final int recentMessageWindowSize;
  final bool automaticSummarization;
  final String memoryTtl;
  final bool useRedis;
  final bool usePostgreSql;

  MemorySettingsConfig toEntity() {
    return MemorySettingsConfig(
      enableShortTermMemory: enableShortTermMemory,
      enableLongTermMemory: enableLongTermMemory,
      enableOperationalMemory: enableOperationalMemory,
      recentMessageWindowSize: recentMessageWindowSize,
      automaticSummarization: automaticSummarization,
      memoryTtl: memoryTtl,
      useRedis: useRedis,
      usePostgreSql: usePostgreSql,
    );
  }
}

class OrchestratorConfigModel {
  const OrchestratorConfigModel({
    required this.automaticMode,
    required this.assistedMode,
    required this.enableRoleDetection,
    required this.enableIntentClassification,
    required this.enableToolExecution,
    required this.requireConfirmationForCriticalActions,
    required this.autonomyLevel,
    required this.fallbackStrategy,
  });

  factory OrchestratorConfigModel.fromJson(Map<String, dynamic> json) {
    return OrchestratorConfigModel(
      automaticMode: json['automaticMode'] as bool? ?? true,
      assistedMode: json['assistedMode'] as bool? ?? true,
      enableRoleDetection: json['enableRoleDetection'] as bool? ?? true,
      enableIntentClassification:
          json['enableIntentClassification'] as bool? ?? true,
      enableToolExecution: json['enableToolExecution'] as bool? ?? true,
      requireConfirmationForCriticalActions:
          json['requireConfirmationForCriticalActions'] as bool? ?? true,
      autonomyLevel: json['autonomyLevel'] as String? ?? 'Protegido',
      fallbackStrategy:
          json['fallbackStrategy'] as String? ?? 'Escalar al operador',
    );
  }

  final bool automaticMode;
  final bool assistedMode;
  final bool enableRoleDetection;
  final bool enableIntentClassification;
  final bool enableToolExecution;
  final bool requireConfirmationForCriticalActions;
  final String autonomyLevel;
  final String fallbackStrategy;

  OrchestratorConfig toEntity() {
    return OrchestratorConfig(
      automaticMode: automaticMode,
      assistedMode: assistedMode,
      enableRoleDetection: enableRoleDetection,
      enableIntentClassification: enableIntentClassification,
      enableToolExecution: enableToolExecution,
      requireConfirmationForCriticalActions:
          requireConfirmationForCriticalActions,
      autonomyLevel: autonomyLevel,
      fallbackStrategy: fallbackStrategy,
    );
  }
}

class PromptTemplateConfigModel {
  const PromptTemplateConfigModel({
    required this.id,
    required this.title,
    required this.description,
    required this.content,
    required this.updatedAt,
  });

  factory PromptTemplateConfigModel.fromJson(Map<String, dynamic> json) {
    return PromptTemplateConfigModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      content: json['content'] as String? ?? '',
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  final String id;
  final String title;
  final String description;
  final String content;
  final DateTime updatedAt;

  PromptTemplateConfig toEntity() {
    return PromptTemplateConfig(
      id: id,
      title: title,
      description: description,
      content: content,
      updatedAt: updatedAt,
    );
  }
}

class InternalToolConfigModel {
  const InternalToolConfigModel({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.isEnabled,
  });

  factory InternalToolConfigModel.fromJson(Map<String, dynamic> json) {
    return InternalToolConfigModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? '',
      isEnabled: json['isEnabled'] as bool? ?? false,
    );
  }

  final String id;
  final String name;
  final String description;
  final String category;
  final bool isEnabled;

  InternalToolConfig toEntity() {
    return InternalToolConfig(
      id: id,
      name: name,
      description: description,
      category: category,
      isEnabled: isEnabled,
    );
  }
}

class KnowledgeDocumentConfigModel {
  const KnowledgeDocumentConfigModel({
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

  factory KnowledgeDocumentConfigModel.fromJson(Map<String, dynamic> json) {
    return KnowledgeDocumentConfigModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      status: json['status'] as String? ?? 'Listo',
      kind: json['kind'] as String? ?? 'Documento',
      sizeLabel: json['sizeLabel'] as String? ?? '-',
      isEnabled: json['isEnabled'] as bool? ?? true,
      chunkCount: json['chunkCount'] as int?,
      indexingError: json['indexingError'] as String?,
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
    );
  }

  factory KnowledgeDocumentConfigModel.fromBackendJson(
    Map<String, dynamic> json,
  ) {
    final rawSize = json['size'];
    final parsedSize = rawSize is num
        ? rawSize.toInt()
        : int.tryParse(rawSize?.toString() ?? '');

    final indexing = (json['metadata'] is Map)
        ? ((json['metadata'] as Map)['indexing'] is Map
            ? ((json['metadata'] as Map)['indexing'] as Map)
            : null)
        : null;
    final rawStatus = (json['status'] as String? ?? 'ready').toLowerCase();

    return KnowledgeDocumentConfigModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      status: _formatDocumentStatusLabel(rawStatus),
      kind: _formatDocumentKindLabel(json['kind'] as String? ?? 'document'),
      sizeLabel: _formatSizeLabel(parsedSize),
      isEnabled: rawStatus != 'disabled',
      chunkCount: _tryParseInt(indexing?['chunkCount']),
      indexingError: indexing?['error'] as String?,
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
    );
  }

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

  KnowledgeDocumentConfig toEntity() {
    return KnowledgeDocumentConfig(
      id: id,
      name: name,
      summary: summary,
      status: status,
      kind: kind,
      sizeLabel: sizeLabel,
      isEnabled: isEnabled,
      chunkCount: chunkCount,
      indexingError: indexingError,
      updatedAt: updatedAt,
    );
  }
}

class SecuritySettingsConfigModel {
  const SecuritySettingsConfigModel({
    required this.internalApiToken,
    required this.webhookSigningSecret,
    required this.encryptSecrets,
    required this.auditLog,
  });

  factory SecuritySettingsConfigModel.fromJson(Map<String, dynamic> json) {
    return SecuritySettingsConfigModel(
      internalApiToken: json['internalApiToken'] as String? ?? '',
      webhookSigningSecret: json['webhookSigningSecret'] as String? ?? '',
      encryptSecrets: json['encryptSecrets'] as bool? ?? true,
      auditLog: json['auditLog'] as bool? ?? true,
    );
  }

  final String internalApiToken;
  final String webhookSigningSecret;
  final bool encryptSecrets;
  final bool auditLog;

  SecuritySettingsConfig toEntity() {
    return SecuritySettingsConfig(
      internalApiToken: internalApiToken,
      webhookSigningSecret: webhookSigningSecret,
      encryptSecrets: encryptSecrets,
      auditLog: auditLog,
    );
  }
}

class BotConfigurationBundleModel {
  const BotConfigurationBundleModel({
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

  factory BotConfigurationBundleModel.mock() {
    return BotConfigurationBundleModel(
      general: const GeneralBotConfigModel(
        botName: 'Asistente Empresarial FULLPOS',
        defaultLanguage: 'pt-BR',
        isEnabled: true,
        environmentLabel: 'Producción',
      ),
      evolutionApi: const EvolutionApiConfigModel(
        baseUrl: 'https://evolution.fullpos.internal',
        instanceName: 'fullpos-main-instance',
        apiKey: 'evo_live_********************************',
        webhookSecret: 'whsec_********************************',
        connectedNumber: '+55 11 4004-1000',
        channelId: null,
        connectionStatus: 'disconnected',
        provisioningStatus: 'idle',
        provisioningError: null,
        isEnabled: true,
      ),
      openAi: const OpenAiConfigModel(
        apiKey: 'sk-live-********************************',
        model: 'gpt-5.4-mini',
        temperature: 0.2,
        maxTokens: 1400,
        isEnabled: true,
        systemPromptPreview:
            'Asistente empresarial ajustado para ventas, soporte, guía de catálogo y escalado seguro para operadores.',
      ),
      memory: const MemorySettingsConfigModel(
        enableShortTermMemory: true,
        enableLongTermMemory: true,
        enableOperationalMemory: true,
        recentMessageWindowSize: 20,
        automaticSummarization: true,
        memoryTtl: '30d',
        useRedis: true,
        usePostgreSql: true,
      ),
      orchestrator: const OrchestratorConfigModel(
        automaticMode: true,
        assistedMode: true,
        enableRoleDetection: true,
        enableIntentClassification: true,
        enableToolExecution: true,
        requireConfirmationForCriticalActions: true,
        autonomyLevel: 'Protegido',
        fallbackStrategy: 'Escalar al operador',
      ),
      prompts: <PromptTemplateConfigModel>[
        PromptTemplateConfigModel(
          id: 'prompt-001',
          title: 'Prompt maestro del sistema',
          description: 'Prompt operativo empresarial principal del asistente.',
          content:
              'Usa el contexto de la conversación, conocimiento del producto, perfil del cliente y memoria de políticas antes de responder. Nunca inventes disponibilidad de producto ni precios.',
          updatedAt: DateTime.now().subtract(const Duration(minutes: 18)),
        ),
        PromptTemplateConfigModel(
          id: 'prompt-002',
          title: 'Prompt de guía de catálogo',
          description:
              'Prompt especializado cuando el usuario pregunta por productos y estructura del catálogo.',
          content:
              'Cuando se solicite un producto, busca primero conocimiento específico del producto. Si no hay detalle estructurado disponible, indica la limitación y evita inventar atributos.',
          updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
        ),
        PromptTemplateConfigModel(
          id: 'prompt-003',
          title: 'Prompt de confirmación de acción crítica',
          description:
              'Controla el flujo de confirmación para acciones riesgosas.',
          content:
              'Para cancelaciones, sobrescrituras de precio, compromisos financieros y reconfiguración de canal, requiere confirmación antes de ejecutar.',
          updatedAt: DateTime.now().subtract(const Duration(days: 1)),
        ),
      ],
      tools: const <InternalToolConfigModel>[
        InternalToolConfigModel(
          id: 'tool-001',
          name: 'Resolutor de conocimiento de catálogo',
          description:
              'Resuelve conocimiento detallado de producto, variantes, restricciones y resúmenes de catálogo aprobados.',
          category: 'Conocimiento',
          isEnabled: true,
        ),
        InternalToolConfigModel(
          id: 'tool-002',
          name: 'Consulta de CRM',
          description:
              'Carga propietario del cliente, etapa del ciclo de vida y metadatos de la cuenta.',
          category: 'Datos del cliente',
          isEnabled: true,
        ),
        InternalToolConfigModel(
          id: 'tool-003',
          name: 'Validador de políticas de pedidos',
          description:
              'Verifica políticas operativas y restricciones de cumplimiento.',
          category: 'Operaciones',
          isEnabled: true,
        ),
        InternalToolConfigModel(
          id: 'tool-004',
          name: 'Traspaso a humano',
          description:
              'Enruta la conversación a un operador preservando el contexto.',
          category: 'Soporte',
          isEnabled: false,
        ),
      ],
      documents: <KnowledgeDocumentConfigModel>[
        KnowledgeDocumentConfigModel(
          id: 'doc-001',
          name: 'Catalogo principal 2025',
          summary:
              'Catálogo maestro con líneas de producto, marcas priorizadas y restricciones de venta.',
          status: 'Indexado',
          kind: 'Catalogo',
          sizeLabel: '2.4 MB',
          isEnabled: true,
          chunkCount: 42,
          indexingError: null,
          updatedAt: DateTime.now().subtract(const Duration(minutes: 12)),
        ),
        KnowledgeDocumentConfigModel(
          id: 'doc-002',
          name: 'Politicas comerciales',
          summary:
              'Políticas de devoluciones, garantías, escalado y validación de descuentos.',
          status: 'Listo',
          kind: 'Politica',
          sizeLabel: '640 KB',
          isEnabled: true,
          chunkCount: 12,
          indexingError: null,
          updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
        ),
      ],
      security: const SecuritySettingsConfigModel(
        internalApiToken: 'fullpos_internal_********************************',
        webhookSigningSecret: 'sign_********************************',
        encryptSecrets: true,
        auditLog: true,
      ),
    );
  }

  factory BotConfigurationBundleModel.fromBackendJson(
    Map<String, dynamic> json, {
    List<dynamic> documents = const <dynamic>[],
  }) {
    return BotConfigurationBundleModel(
      general: GeneralBotConfigModel.fromJson(
        (json['general'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{},
      ),
      evolutionApi: EvolutionApiConfigModel.fromJson(
        (json['evolution'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{},
      ),
      openAi: OpenAiConfigModel.fromJson(
        (json['openai'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{},
      ),
      memory: MemorySettingsConfigModel.fromJson(
        (json['memory'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{},
      ),
      orchestrator: OrchestratorConfigModel.fromJson({
        ...((json['orchestrator'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{}),
        'autonomyLevel': _mapAutonomyLevelFromBackend(
          (json['orchestrator'] as Map?)?['autonomyLevel'] as String?,
        ),
      }),
      prompts: ((json['prompts'] as List?) ?? const <dynamic>[])
          .whereType<Map>()
          .map((item) => PromptTemplateConfigModel.fromJson(
                item.cast<String, dynamic>(),
              ))
          .toList(growable: false),
      tools: ((json['tools'] as List?) ?? const <dynamic>[])
          .whereType<Map>()
          .map((item) => InternalToolConfigModel.fromJson(
                item.cast<String, dynamic>(),
              ))
          .toList(growable: false),
      documents: documents
          .whereType<Map>()
          .map((item) => KnowledgeDocumentConfigModel.fromBackendJson(
                item.cast<String, dynamic>(),
              ))
          .toList(growable: false),
      security: SecuritySettingsConfigModel.fromJson(
        (json['security'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{},
      ),
    );
  }

  final GeneralBotConfigModel general;
  final EvolutionApiConfigModel evolutionApi;
  final OpenAiConfigModel openAi;
  final MemorySettingsConfigModel memory;
  final OrchestratorConfigModel orchestrator;
  final List<PromptTemplateConfigModel> prompts;
  final List<InternalToolConfigModel> tools;
  final List<KnowledgeDocumentConfigModel> documents;
  final SecuritySettingsConfigModel security;

  BotConfigurationBundle toEntity() {
    return BotConfigurationBundle(
      general: general.toEntity(),
      evolutionApi: evolutionApi.toEntity(),
      openAi: openAi.toEntity(),
      memory: memory.toEntity(),
      orchestrator: orchestrator.toEntity(),
      prompts: prompts.map((item) => item.toEntity()).toList(growable: false),
      tools: tools.map((item) => item.toEntity()).toList(growable: false),
      documents:
          documents.map((item) => item.toEntity()).toList(growable: false),
      security: security.toEntity(),
    );
  }
}

String _mapAutonomyLevelFromBackend(String? value) {
  switch ((value ?? '').toLowerCase()) {
    case 'strict':
      return 'Estricto';
    case 'guarded':
      return 'Protegido';
    case 'balanced':
      return 'Equilibrado';
    default:
      return 'Protegido';
  }
}

String _formatSizeLabel(int? size) {
  if (size == null || size <= 0) {
    return '-';
  }
  if (size < 1024) {
    return '$size B';
  }
  if (size < 1024 * 1024) {
    return '${(size / 1024).toStringAsFixed(1)} KB';
  }
  return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String _formatDocumentStatusLabel(String status) {
  switch (status.toLowerCase()) {
    case 'pending_index':
      return 'Pendiente de indexar';
    case 'indexing':
      return 'Indexando';
    case 'ready':
      return 'Listo';
    case 'failed':
      return 'Fallido';
    case 'disabled':
      return 'Deshabilitado';
    default:
      return status;
  }
}

String _formatDocumentKindLabel(String kind) {
  switch (kind.toLowerCase()) {
    case 'catalog':
      return 'Catalogo';
    case 'policy':
      return 'Politica';
    case 'faq':
      return 'FAQ';
    case 'document':
      return 'Documento';
    default:
      return kind;
  }
}

int? _tryParseInt(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '');
}
