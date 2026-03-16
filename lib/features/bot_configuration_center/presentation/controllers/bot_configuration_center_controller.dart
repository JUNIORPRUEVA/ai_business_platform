import 'package:flutter/material.dart';

import '../../data/models/bot_configuration_models.dart';
import '../../domain/entities/bot_configuration_bundle.dart';
import '../../domain/entities/bot_configuration_section.dart';

class BotConfigurationCenterController extends ChangeNotifier {
  BotConfigurationCenterController()
      : _bundle = BotConfigurationBundleModel.mock().toEntity(),
        generalBotNameController = TextEditingController(),
        generalEnvironmentController = TextEditingController(),
        evolutionBaseUrlController = TextEditingController(),
        evolutionInstanceController = TextEditingController(),
        evolutionApiKeyController = TextEditingController(),
        evolutionWebhookSecretController = TextEditingController(),
        evolutionConnectedNumberController = TextEditingController(),
        openAiApiKeyController = TextEditingController(),
        openAiTemperatureController = TextEditingController(),
        openAiMaxTokensController = TextEditingController(),
        openAiSystemPromptPreviewController = TextEditingController(),
        memoryWindowSizeController = TextEditingController(),
        memoryTtlController = TextEditingController(),
        securityInternalApiTokenController = TextEditingController(),
        securityWebhookSigningSecretController = TextEditingController() {
    _applyBundleToControllers();
  }

  final TextEditingController generalBotNameController;
  final TextEditingController generalEnvironmentController;
  final TextEditingController evolutionBaseUrlController;
  final TextEditingController evolutionInstanceController;
  final TextEditingController evolutionApiKeyController;
  final TextEditingController evolutionWebhookSecretController;
  final TextEditingController evolutionConnectedNumberController;
  final TextEditingController openAiApiKeyController;
  final TextEditingController openAiTemperatureController;
  final TextEditingController openAiMaxTokensController;
  final TextEditingController openAiSystemPromptPreviewController;
  final TextEditingController memoryWindowSizeController;
  final TextEditingController memoryTtlController;
  final TextEditingController securityInternalApiTokenController;
  final TextEditingController securityWebhookSigningSecretController;

  BotConfigurationBundle _bundle;
  BotConfigurationSection _selectedSection = BotConfigurationSection.general;
  String _selectedLanguage = 'pt-BR';
  String _selectedOpenAiModel = 'gpt-5.4-mini';
  String _selectedAutonomyLevel = 'Protegido';
  String _selectedFallbackStrategy = 'Escalar al operador';
  int _selectedPromptIndex = 0;
  int _selectedDocumentIndex = 0;
  bool _isTesting = false;
  BotConfigurationSection? _activeSaveSection;
  String? _errorMessage;
  String? _successMessage;

  BotConfigurationBundle get bundle => _bundle;
  BotConfigurationSection get selectedSection => _selectedSection;
  String get selectedLanguage => _selectedLanguage;
  String get selectedOpenAiModel => _selectedOpenAiModel;
  String get selectedAutonomyLevel => _selectedAutonomyLevel;
  String get selectedFallbackStrategy => _selectedFallbackStrategy;
  int get selectedPromptIndex => _selectedPromptIndex;
  int get selectedDocumentIndex => _selectedDocumentIndex;
  bool get isTesting => _isTesting;
  BotConfigurationSection? get activeSaveSection => _activeSaveSection;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;

  List<String> get availableLanguages => const <String>[
        'pt-BR',
        'en-US',
        'es-ES',
      ];

  List<String> get availableModels => const <String>[
        'gpt-5.4-mini',
        'gpt-5.4',
        'gpt-4.1',
      ];

  List<String> get availableAutonomyLevels => const <String>[
        'Estricto',
        'Protegido',
        'Equilibrado',
        'Agresivo',
      ];

  List<String> get availableFallbackStrategies => const <String>[
        'Escalar al operador',
        'Solicitar aclaración',
        'Usar respuesta segura predefinida',
      ];

  PromptTemplateConfig get selectedPrompt {
    if (_bundle.prompts.isEmpty) {
      return PromptTemplateConfig(
        id: 'empty',
        title: 'Sin prompt configurado',
        description: 'No hay activos de prompt cargados.',
        content: '',
        updatedAt: DateTime.now(),
      );
    }

    return _bundle
        .prompts[_selectedPromptIndex.clamp(0, _bundle.prompts.length - 1)];
  }

  KnowledgeDocumentConfig? get selectedDocument {
    if (_bundle.documents.isEmpty) {
      return null;
    }

    return _bundle.documents[
        _selectedDocumentIndex.clamp(0, _bundle.documents.length - 1)];
  }

  void selectSection(BotConfigurationSection section) {
    _selectedSection = section;
    notifyListeners();
  }

  void selectPrompt(int index) {
    if (index < 0 || index >= _bundle.prompts.length) {
      return;
    }

    _selectedPromptIndex = index;
    notifyListeners();
  }

  void selectDocument(int index) {
    if (index < 0 || index >= _bundle.documents.length) {
      return;
    }

    _selectedDocumentIndex = index;
    notifyListeners();
  }

  void setLanguage(String? value) {
    if (value == null) {
      return;
    }

    _selectedLanguage = value;
    notifyListeners();
  }

  void setOpenAiModel(String? value) {
    if (value == null) {
      return;
    }

    _selectedOpenAiModel = value;
    notifyListeners();
  }

  void setAutonomyLevel(String? value) {
    if (value == null) {
      return;
    }

    _selectedAutonomyLevel = value;
    notifyListeners();
  }

  void setFallbackStrategy(String? value) {
    if (value == null) {
      return;
    }

    _selectedFallbackStrategy = value;
    notifyListeners();
  }

  void toggleGeneralEnabled(bool value) {
    _bundle = _bundle.copyWith(
      general: _bundle.general.copyWith(isEnabled: value),
    );
    notifyListeners();
  }

  void toggleEvolutionEnabled(bool value) {
    _bundle = _bundle.copyWith(
      evolutionApi: _bundle.evolutionApi.copyWith(isEnabled: value),
    );
    notifyListeners();
  }

  void toggleOpenAiEnabled(bool value) {
    _bundle = _bundle.copyWith(
      openAi: _bundle.openAi.copyWith(isEnabled: value),
    );
    notifyListeners();
  }

  void updateMemorySettings({
    bool? enableShortTermMemory,
    bool? enableLongTermMemory,
    bool? enableOperationalMemory,
    bool? automaticSummarization,
    bool? useRedis,
    bool? usePostgreSql,
  }) {
    _bundle = _bundle.copyWith(
      memory: _bundle.memory.copyWith(
        enableShortTermMemory:
            enableShortTermMemory ?? _bundle.memory.enableShortTermMemory,
        enableLongTermMemory:
            enableLongTermMemory ?? _bundle.memory.enableLongTermMemory,
        enableOperationalMemory:
            enableOperationalMemory ?? _bundle.memory.enableOperationalMemory,
        automaticSummarization:
            automaticSummarization ?? _bundle.memory.automaticSummarization,
        useRedis: useRedis ?? _bundle.memory.useRedis,
        usePostgreSql: usePostgreSql ?? _bundle.memory.usePostgreSql,
      ),
    );
    notifyListeners();
  }

  void updateOrchestratorSettings({
    bool? automaticMode,
    bool? assistedMode,
    bool? enableRoleDetection,
    bool? enableIntentClassification,
    bool? enableToolExecution,
    bool? requireConfirmationForCriticalActions,
  }) {
    _bundle = _bundle.copyWith(
      orchestrator: _bundle.orchestrator.copyWith(
        automaticMode: automaticMode ?? _bundle.orchestrator.automaticMode,
        assistedMode: assistedMode ?? _bundle.orchestrator.assistedMode,
        enableRoleDetection:
            enableRoleDetection ?? _bundle.orchestrator.enableRoleDetection,
        enableIntentClassification: enableIntentClassification ??
            _bundle.orchestrator.enableIntentClassification,
        enableToolExecution:
            enableToolExecution ?? _bundle.orchestrator.enableToolExecution,
        requireConfirmationForCriticalActions:
            requireConfirmationForCriticalActions ??
                _bundle.orchestrator.requireConfirmationForCriticalActions,
      ),
    );
    notifyListeners();
  }

  void updatePromptContent(String value) {
    if (_bundle.prompts.isEmpty) {
      return;
    }

    final updatedPrompts = _bundle.prompts.toList(growable: true);
    updatedPrompts[_selectedPromptIndex] =
        updatedPrompts[_selectedPromptIndex].copyWith(content: value);
    _bundle = _bundle.copyWith(prompts: updatedPrompts);
    notifyListeners();
  }

  void toggleTool(String toolId, bool value) {
    final updatedTools = _bundle.tools
        .map(
          (tool) => tool.id == toolId ? tool.copyWith(isEnabled: value) : tool,
        )
        .toList(growable: false);
    _bundle = _bundle.copyWith(tools: updatedTools);
    notifyListeners();
  }

  void toggleDocument(String documentId, bool value) {
    final updatedDocuments = _bundle.documents
        .map(
          (document) => document.id == documentId
              ? document.copyWith(isEnabled: value)
              : document,
        )
        .toList(growable: false);
    _bundle = _bundle.copyWith(documents: updatedDocuments);
    notifyListeners();
  }

  void updateDocumentSummary(String documentId, String value) {
    final updatedDocuments = _bundle.documents
        .map(
          (document) => document.id == documentId
              ? document.copyWith(summary: value)
              : document,
        )
        .toList(growable: false);
    _bundle = _bundle.copyWith(documents: updatedDocuments);
    notifyListeners();
  }

  void addDocument() {
    final nextDocuments = _bundle.documents.toList(growable: true)
      ..insert(
        0,
        KnowledgeDocumentConfig(
          id: 'doc-${DateTime.now().microsecondsSinceEpoch}',
          name: 'Nuevo documento empresarial',
          summary:
              'Describe aquí el contenido indexado que el cerebro debe usar como conocimiento.',
          status: 'Pendiente',
          kind: 'Documento',
          sizeLabel: '-',
          isEnabled: true,
        ),
      );
    _bundle = _bundle.copyWith(documents: nextDocuments);
    _selectedDocumentIndex = 0;
    notifyListeners();
  }

  void removeDocument(String documentId) {
    final nextDocuments = _bundle.documents
        .where((document) => document.id != documentId)
        .toList(growable: false);
    _bundle = _bundle.copyWith(documents: nextDocuments);
    if (_selectedDocumentIndex >= nextDocuments.length) {
      _selectedDocumentIndex =
          nextDocuments.isEmpty ? 0 : nextDocuments.length - 1;
    }
    notifyListeners();
  }

  void updateSecuritySettings({bool? encryptSecrets, bool? auditLog}) {
    _bundle = _bundle.copyWith(
      security: _bundle.security.copyWith(
        encryptSecrets: encryptSecrets ?? _bundle.security.encryptSecrets,
        auditLog: auditLog ?? _bundle.security.auditLog,
      ),
    );
    notifyListeners();
  }

  Future<void> testConnection(BotConfigurationSection section) async {
    _clearBanners();
    _isTesting = true;
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 850));

    _isTesting = false;
    _successMessage = switch (section) {
      BotConfigurationSection.evolutionApi =>
        'Conexión de Evolution API verificada correctamente.',
      BotConfigurationSection.openAi =>
        'Credenciales del runtime de OpenAI validadas correctamente.',
      _ => 'Prueba de conectividad completada correctamente.',
    };
    notifyListeners();
  }

  Future<void> saveSection(BotConfigurationSection section) async {
    _clearBanners();
    _activeSaveSection = section;
    _syncDraftsIntoState();
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 900));

    _activeSaveSection = null;
    _successMessage =
        'Configuración de ${section.label} guardada correctamente.';
    notifyListeners();
  }

  void dismissBanners() {
    _clearBanners();
    notifyListeners();
  }

  void _syncDraftsIntoState() {
    final temperature =
        double.tryParse(openAiTemperatureController.text.trim()) ??
            _bundle.openAi.temperature;
    final maxTokens = int.tryParse(openAiMaxTokensController.text.trim()) ??
        _bundle.openAi.maxTokens;
    final memoryWindow = int.tryParse(memoryWindowSizeController.text.trim()) ??
        _bundle.memory.recentMessageWindowSize;

    _bundle = _bundle.copyWith(
      general: _bundle.general.copyWith(
        botName: generalBotNameController.text.trim(),
        defaultLanguage: _selectedLanguage,
        environmentLabel: generalEnvironmentController.text.trim(),
      ),
      evolutionApi: _bundle.evolutionApi.copyWith(
        baseUrl: evolutionBaseUrlController.text.trim(),
        instanceName: evolutionInstanceController.text.trim(),
        apiKey: evolutionApiKeyController.text.trim(),
        webhookSecret: evolutionWebhookSecretController.text.trim(),
        connectedNumber: evolutionConnectedNumberController.text.trim(),
      ),
      openAi: _bundle.openAi.copyWith(
        apiKey: openAiApiKeyController.text.trim(),
        model: _selectedOpenAiModel,
        temperature: temperature,
        maxTokens: maxTokens,
        systemPromptPreview: openAiSystemPromptPreviewController.text.trim(),
      ),
      memory: _bundle.memory.copyWith(
        recentMessageWindowSize: memoryWindow,
        memoryTtl: memoryTtlController.text.trim(),
      ),
      orchestrator: _bundle.orchestrator.copyWith(
        autonomyLevel: _selectedAutonomyLevel,
        fallbackStrategy: _selectedFallbackStrategy,
      ),
      security: _bundle.security.copyWith(
        internalApiToken: securityInternalApiTokenController.text.trim(),
        webhookSigningSecret:
            securityWebhookSigningSecretController.text.trim(),
      ),
    );
  }

  void _applyBundleToControllers() {
    generalBotNameController.text = _bundle.general.botName;
    generalEnvironmentController.text = _bundle.general.environmentLabel;
    evolutionBaseUrlController.text = _bundle.evolutionApi.baseUrl;
    evolutionInstanceController.text = _bundle.evolutionApi.instanceName;
    evolutionApiKeyController.text = _bundle.evolutionApi.apiKey;
    evolutionWebhookSecretController.text = _bundle.evolutionApi.webhookSecret;
    evolutionConnectedNumberController.text =
        _bundle.evolutionApi.connectedNumber;
    openAiApiKeyController.text = _bundle.openAi.apiKey;
    openAiTemperatureController.text = _bundle.openAi.temperature.toString();
    openAiMaxTokensController.text = _bundle.openAi.maxTokens.toString();
    openAiSystemPromptPreviewController.text =
        _bundle.openAi.systemPromptPreview;
    memoryWindowSizeController.text =
        _bundle.memory.recentMessageWindowSize.toString();
    memoryTtlController.text = _bundle.memory.memoryTtl;
    securityInternalApiTokenController.text = _bundle.security.internalApiToken;
    securityWebhookSigningSecretController.text =
        _bundle.security.webhookSigningSecret;
    _selectedLanguage = _bundle.general.defaultLanguage;
    _selectedOpenAiModel = _bundle.openAi.model;
    _selectedAutonomyLevel = _bundle.orchestrator.autonomyLevel;
    _selectedFallbackStrategy = _bundle.orchestrator.fallbackStrategy;
  }

  void _clearBanners() {
    _errorMessage = null;
    _successMessage = null;
  }

  @override
  void dispose() {
    generalBotNameController.dispose();
    generalEnvironmentController.dispose();
    evolutionBaseUrlController.dispose();
    evolutionInstanceController.dispose();
    evolutionApiKeyController.dispose();
    evolutionWebhookSecretController.dispose();
    evolutionConnectedNumberController.dispose();
    openAiApiKeyController.dispose();
    openAiTemperatureController.dispose();
    openAiMaxTokensController.dispose();
    openAiSystemPromptPreviewController.dispose();
    memoryWindowSizeController.dispose();
    memoryTtlController.dispose();
    securityInternalApiTokenController.dispose();
    securityWebhookSigningSecretController.dispose();
    super.dispose();
  }
}
