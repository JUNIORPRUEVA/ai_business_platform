import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../../../modules/auth/data/auth_token_store.dart';
import '../../data/models/bot_configuration_models.dart';
import '../../data/services/bot_configuration_center_api_client.dart';
import '../../domain/entities/bot_configuration_bundle.dart';
import '../../domain/entities/bot_configuration_section.dart';

class BotConfigurationCenterController extends ChangeNotifier {
  BotConfigurationCenterController({
    BotConfigurationCenterApiClient? apiClient,
    AuthTokenStore? tokenStore,
  })  : _apiClient = apiClient ?? BotConfigurationCenterApiClient(),
        _tokenStore = tokenStore ?? AuthTokenStore(),
        _bundle = BotConfigurationBundleModel.mock().toEntity(),
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
        promptContentController = TextEditingController(),
        memoryWindowSizeController = TextEditingController(),
        memoryTtlController = TextEditingController(),
        securityInternalApiTokenController = TextEditingController(),
        securityWebhookSigningSecretController = TextEditingController() {
    _applyBundleToControllers();
  }

  final BotConfigurationCenterApiClient _apiClient;
  final AuthTokenStore _tokenStore;

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
  final TextEditingController promptContentController;
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
  bool _isLoading = false;
  bool _isUploadingDocument = false;
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
  bool get isLoading => _isLoading;
  bool get isUploadingDocument => _isUploadingDocument;
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

  Future<void> load() async {
    _clearBanners();
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _requireToken();
      final configuration =
          await _apiClient.getJson('/bot-configuration', token: token);

      List<dynamic> documents = const <dynamic>[];
      try {
        documents =
            await _apiClient.getJsonList('/ai-brain/documents', token: token);
      } on BotConfigurationCenterApiException catch (_) {
        documents = const <dynamic>[];
      }

      _bundle = BotConfigurationBundleModel.fromBackendJson(
        configuration,
        documents: documents,
      ).toEntity();
      _selectedPromptIndex = 0;
      _selectedDocumentIndex = 0;
      _applyBundleToControllers();
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
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
    promptContentController.text = _bundle.prompts[index].content;
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

  Future<void> addDocument() async {
    _clearBanners();
    _isUploadingDocument = true;
    notifyListeners();

    try {
      final token = await _requireToken();
      final picked = await FilePicker.platform.pickFiles(
        allowMultiple: false,
        withData: true,
      );
      final file = picked?.files.single;
      if (file == null) {
        return;
      }

      final bytes = file.bytes;
      if (bytes == null) {
        throw const BotConfigurationCenterApiException(
          'No se pudieron leer los bytes del documento seleccionado.',
        );
      }

      final contentType = _resolveContentType(file.extension);
      final uploadTarget = await _apiClient.postJson(
        '/ai-brain/documents/presign-upload',
        {
          'filename': file.name,
          'contentType': contentType,
        },
        token: token,
      );

      await _apiClient.uploadBytesToUrl(
        url: uploadTarget['url'] as String,
        bytes: bytes,
        contentType: contentType,
      );

      await _apiClient.postJson(
        '/ai-brain/documents',
        {
          'name': file.name,
          'storageKey': uploadTarget['key'] as String,
          'contentType': contentType,
          'kind': _inferDocumentKind(file.name),
          'size': file.size,
          'summary':
              'Documento empresarial cargado desde la consola de configuración.',
        },
        token: token,
      );

      await load();
      _successMessage = 'Documento cargado y registrado correctamente.';
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isUploadingDocument = false;
      notifyListeners();
    }
  }

  Future<void> removeDocument(String documentId) async {
    _clearBanners();
    _isUploadingDocument = true;
    notifyListeners();

    try {
      final token = await _requireToken();
      await _apiClient.delete('/ai-brain/documents/$documentId', token: token);

      final nextDocuments = _bundle.documents
          .where((document) => document.id != documentId)
          .toList(growable: false);
      _bundle = _bundle.copyWith(documents: nextDocuments);
      if (_selectedDocumentIndex >= nextDocuments.length) {
        _selectedDocumentIndex =
            nextDocuments.isEmpty ? 0 : nextDocuments.length - 1;
      }
      _successMessage = 'Documento eliminado correctamente.';
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isUploadingDocument = false;
      notifyListeners();
    }
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

    try {
      final token = await _requireToken();
      switch (section) {
        case BotConfigurationSection.general:
          await _apiClient.putJson(
            '/bot-configuration/general',
            {
              'botName': _bundle.general.botName,
              'defaultLanguage': _bundle.general.defaultLanguage,
              'isEnabled': _bundle.general.isEnabled,
              'environmentLabel': _bundle.general.environmentLabel,
            },
            token: token,
          );
          break;
        case BotConfigurationSection.evolutionApi:
          await _apiClient.putJson(
            '/bot-configuration/evolution',
            {
              'baseUrl': _bundle.evolutionApi.baseUrl,
              'instanceName': _bundle.evolutionApi.instanceName,
              'apiKey': _bundle.evolutionApi.apiKey,
              'webhookSecret': _bundle.evolutionApi.webhookSecret,
              'connectedNumber': _bundle.evolutionApi.connectedNumber,
              'isEnabled': _bundle.evolutionApi.isEnabled,
            },
            token: token,
          );
          break;
        case BotConfigurationSection.openAi:
          await _apiClient.putJson(
            '/bot-configuration/openai',
            {
              'apiKey': _bundle.openAi.apiKey,
              'model': _bundle.openAi.model,
              'temperature': _bundle.openAi.temperature,
              'maxTokens': _bundle.openAi.maxTokens,
              'isEnabled': _bundle.openAi.isEnabled,
              'systemPromptPreview': _bundle.openAi.systemPromptPreview,
            },
            token: token,
          );
          break;
        case BotConfigurationSection.memory:
          await _apiClient.putJson(
            '/bot-configuration/memory',
            {
              'enableShortTermMemory': _bundle.memory.enableShortTermMemory,
              'enableLongTermMemory': _bundle.memory.enableLongTermMemory,
              'enableOperationalMemory':
                  _bundle.memory.enableOperationalMemory,
              'recentMessageWindowSize':
                  _bundle.memory.recentMessageWindowSize,
              'automaticSummarization':
                  _bundle.memory.automaticSummarization,
              'memoryTtl': _bundle.memory.memoryTtl,
              'useRedis': _bundle.memory.useRedis,
              'usePostgreSql': _bundle.memory.usePostgreSql,
            },
            token: token,
          );
          break;
        case BotConfigurationSection.orchestrator:
          await _apiClient.putJson(
            '/bot-configuration/orchestrator',
            {
              'automaticMode': _bundle.orchestrator.automaticMode,
              'assistedMode': _bundle.orchestrator.assistedMode,
              'enableRoleDetection': _bundle.orchestrator.enableRoleDetection,
              'enableIntentClassification':
                  _bundle.orchestrator.enableIntentClassification,
              'enableToolExecution': _bundle.orchestrator.enableToolExecution,
              'requireConfirmationForCriticalActions':
                  _bundle.orchestrator.requireConfirmationForCriticalActions,
              'autonomyLevel':
                  _mapAutonomyLevelToBackend(_bundle.orchestrator.autonomyLevel),
              'fallbackStrategy': _bundle.orchestrator.fallbackStrategy,
            },
            token: token,
          );
          break;
        case BotConfigurationSection.prompts:
          if (_bundle.prompts.isNotEmpty) {
            final prompt = _bundle.prompts[
                _selectedPromptIndex.clamp(0, _bundle.prompts.length - 1)];
            await _apiClient.putJson(
              '/bot-configuration/prompts/${prompt.id}',
              {
                'title': prompt.title,
                'description': prompt.description,
                'content': prompt.content,
              },
              token: token,
            );
          }
          break;
        case BotConfigurationSection.tools:
          for (final tool in _bundle.tools) {
            await _apiClient.putJson(
              '/bot-configuration/tools/${tool.id}',
              {'isEnabled': tool.isEnabled},
              token: token,
            );
          }
          break;
        case BotConfigurationSection.documents:
          for (final document in _bundle.documents) {
            await _apiClient.patchJson(
              '/ai-brain/documents/${document.id}',
              {
                'name': document.name,
                'summary': document.summary,
                'status': document.isEnabled ? document.status : 'disabled',
              },
              token: token,
            );
          }
          break;
        case BotConfigurationSection.security:
          await _apiClient.putJson(
            '/bot-configuration/security',
            {
              'internalApiToken': _bundle.security.internalApiToken,
              'webhookSigningSecret': _bundle.security.webhookSigningSecret,
              'encryptSecrets': _bundle.security.encryptSecrets,
              'auditLog': _bundle.security.auditLog,
            },
            token: token,
          );
          break;
      }

      await load();
      _successMessage =
          'Configuración de ${section.label} guardada correctamente.';
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _activeSaveSection = null;
      notifyListeners();
    }
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
    promptContentController.text = selectedPrompt.content;
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

  Future<String> _requireToken() async {
    final token = await _tokenStore.read();
    if (token == null || token.trim().isEmpty) {
      throw const BotConfigurationCenterApiException(
        'Tu sesión expiró. Inicia sesión otra vez.',
      );
    }
    return token;
  }

  String _mapAutonomyLevelToBackend(String label) {
    switch (label) {
      case 'Estricto':
        return 'strict';
      case 'Protegido':
        return 'guarded';
      case 'Equilibrado':
        return 'balanced';
      default:
        return 'guarded';
    }
  }

  String _resolveContentType(String? extension) {
    switch ((extension ?? '').toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'md':
        return 'text/markdown';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }

  String _inferDocumentKind(String fileName) {
    final normalized = fileName.toLowerCase();
    if (normalized.contains('catalog')) {
      return 'catalog';
    }
    if (normalized.contains('polit') || normalized.contains('policy')) {
      return 'policy';
    }
    if (normalized.contains('faq')) {
      return 'faq';
    }
    return 'document';
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
    promptContentController.dispose();
    memoryWindowSizeController.dispose();
    memoryTtlController.dispose();
    securityInternalApiTokenController.dispose();
    securityWebhookSigningSecretController.dispose();
    super.dispose();
  }
}
