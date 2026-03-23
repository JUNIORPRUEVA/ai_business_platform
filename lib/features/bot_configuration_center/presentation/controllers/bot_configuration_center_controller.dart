import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../modules/auth/data/auth_token_store.dart';
import '../../data/models/bot_configuration_models.dart';
import '../../data/services/bot_configuration_center_api_client.dart';
import '../../domain/entities/bot_configuration_bundle.dart';
import '../../domain/entities/bot_configuration_section.dart';

class BotConfigurationCenterController extends ChangeNotifier {
  static const _localBundleKey = 'bot_configuration_center_bundle_v1';

  static const Duration _localPersistDebounce = Duration(milliseconds: 350);
  static const Duration _remoteAutoSaveDebounce = Duration(milliseconds: 900);

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
    _attachDraftListeners();
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
  bool _isProvisioningEvolution = false;
  bool _isRefreshingEvolution = false;
  bool _isApplyingBundleToControllers = false;
  BotConfigurationSection? _activeSaveSection;
  String? _errorMessage;
  String? _successMessage;
  String? _evolutionQrPayloadPreview;
  Uint8List? _evolutionQrImageBytes;
  String? _evolutionPairingCode;

  Timer? _localPersistTimer;
  Timer? _remoteAutoSaveTimer;
  bool _isFlushingAutoSave = false;
  final Set<BotConfigurationSection> _pendingSectionAutoSaves =
      <BotConfigurationSection>{};
  final Set<String> _pendingToolAutoSaves = <String>{};
  final Set<String> _pendingDocumentAutoSaves = <String>{};
  final Set<String> _pendingPromptAutoSaves = <String>{};

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
  bool get isProvisioningEvolution => _isProvisioningEvolution;
  bool get isRefreshingEvolution => _isRefreshingEvolution;
  BotConfigurationSection? get activeSaveSection => _activeSaveSection;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;
  String? get evolutionQrPayloadPreview => _evolutionQrPayloadPreview;
  Uint8List? get evolutionQrImageBytes => _evolutionQrImageBytes;
  String? get evolutionPairingCode => _evolutionPairingCode;

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
      final localBundle = await _readLocalBundle();
      if (localBundle != null) {
        _bundle = localBundle;
        _selectedPromptIndex = 0;
        _selectedDocumentIndex = 0;
        _applyBundleToControllers();
        notifyListeners();
      }

      final configuration =
          await _apiClient.getJson('/bot-configuration', token: token);

      List<dynamic> documents = const <dynamic>[];
      try {
        documents =
            await _apiClient.getJsonList('/ai-brain/documents', token: token);
      } on BotConfigurationCenterApiException catch (_) {
        documents = const <dynamic>[];
      }

      final remoteBundle = BotConfigurationBundleModel.fromBackendJson(
        configuration,
        documents: documents,
      ).toEntity();

      // Remote (DB) is the source of truth. Local cache is only a fallback.
      _bundle = remoteBundle;
      _selectedPromptIndex = 0;
      _selectedDocumentIndex = 0;
      _applyBundleToControllers();
      _evolutionQrPayloadPreview = null;
      _evolutionQrImageBytes = null;
      _evolutionPairingCode = null;
      await _persistLocalBundle();
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;

      // Fall back to local cache if backend is temporarily unavailable.
      final localBundle = await _readLocalBundle();
      if (localBundle != null) {
        _bundle = localBundle;
        _selectedPromptIndex = 0;
        _selectedDocumentIndex = 0;
        _applyBundleToControllers();
      }
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
    _bundle = _bundle.copyWith(
      general: _bundle.general.copyWith(defaultLanguage: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.general);
    notifyListeners();
  }

  void setOpenAiModel(String? value) {
    if (value == null) {
      return;
    }

    _selectedOpenAiModel = value;
    _bundle = _bundle.copyWith(
      openAi: _bundle.openAi.copyWith(model: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.openAi);
    notifyListeners();
  }

  void setAutonomyLevel(String? value) {
    if (value == null) {
      return;
    }

    _selectedAutonomyLevel = value;
    _bundle = _bundle.copyWith(
      orchestrator: _bundle.orchestrator.copyWith(autonomyLevel: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.orchestrator);
    notifyListeners();
  }

  void setFallbackStrategy(String? value) {
    if (value == null) {
      return;
    }

    _selectedFallbackStrategy = value;
    _bundle = _bundle.copyWith(
      orchestrator: _bundle.orchestrator.copyWith(fallbackStrategy: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.orchestrator);
    notifyListeners();
  }

  void toggleGeneralEnabled(bool value) {
    _bundle = _bundle.copyWith(
      general: _bundle.general.copyWith(isEnabled: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.general);
    notifyListeners();
  }

  void toggleEvolutionEnabled(bool value) {
    _bundle = _bundle.copyWith(
      evolutionApi: _bundle.evolutionApi.copyWith(isEnabled: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.evolutionApi);
    notifyListeners();
  }

  void toggleOpenAiEnabled(bool value) {
    _bundle = _bundle.copyWith(
      openAi: _bundle.openAi.copyWith(isEnabled: value),
    );
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.openAi);
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
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.memory);
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
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.orchestrator);
    notifyListeners();
  }

  void updatePromptContent(String value) {
    if (_bundle.prompts.isEmpty) {
      return;
    }

    final updatedPrompts = _bundle.prompts.toList(growable: true);
    updatedPrompts[_selectedPromptIndex] =
        updatedPrompts[_selectedPromptIndex].copyWith(
      content: value,
      updatedAt: DateTime.now(),
    );
    _bundle = _bundle.copyWith(prompts: updatedPrompts);
    _scheduleLocalPersist();
    final promptId = updatedPrompts[_selectedPromptIndex].id;
    if (promptId.trim().isNotEmpty) {
      _scheduleAutoSavePrompt(promptId);
    }
    notifyListeners();
  }

  void toggleTool(String toolId, bool value) {
    final updatedTools = _bundle.tools
        .map(
          (tool) => tool.id == toolId ? tool.copyWith(isEnabled: value) : tool,
        )
        .toList(growable: false);
    _bundle = _bundle.copyWith(tools: updatedTools);
    _scheduleLocalPersist();
    _scheduleAutoSaveTool(toolId);
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
    _scheduleLocalPersist();
    _scheduleAutoSaveDocument(documentId);
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
    _scheduleLocalPersist();
    _scheduleAutoSaveDocument(documentId);
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
      _scheduleLocalPersist();
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
      _scheduleLocalPersist();
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
    _scheduleLocalPersist();
    _scheduleAutoSaveSection(BotConfigurationSection.security);
    notifyListeners();
  }

  Future<void> testConnection(BotConfigurationSection section) async {
    if (section == BotConfigurationSection.evolutionApi) {
      await refreshEvolutionConnection();
      return;
    }

    _clearBanners();
    _isTesting = true;
    _syncDraftsIntoState();
    notifyListeners();

    try {
      if (section == BotConfigurationSection.openAi) {
        final token = await _requireToken();
        final result = await _apiClient.postJson(
          '/bot-configuration/openai/test',
          {
            'apiKey': _bundle.openAi.apiKey,
            'model': _bundle.openAi.model,
          },
          token: token,
        );
        final source = (result['source'] as String?) ?? 'configuration';
        _successMessage =
            'API key de OpenAI validada correctamente. Fuente usada: $source.';
      } else {
        _successMessage = 'Prueba de conectividad completada correctamente.';
      }
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isTesting = false;
      notifyListeners();
    }
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
          await _saveEvolutionSettings(token);
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
              'enableOperationalMemory': _bundle.memory.enableOperationalMemory,
              'recentMessageWindowSize': _bundle.memory.recentMessageWindowSize,
              'automaticSummarization': _bundle.memory.automaticSummarization,
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
              'autonomyLevel': _mapAutonomyLevelToBackend(
                  _bundle.orchestrator.autonomyLevel),
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

      await _persistLocalBundle();
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

  Future<void> provisionEvolutionInstance() async {
    _clearBanners();
    _isProvisioningEvolution = true;
    _syncDraftsIntoState();
    notifyListeners();

    try {
      final token = await _requireToken();
      await _saveEvolutionSettings(token);
      final response = await _apiClient.postJson(
        '/bot-configuration/evolution/provision',
        const <String, dynamic>{},
        token: token,
      );
      _applyEvolutionConnectionResponse(response);
      await _persistLocalBundle();
      _successMessage =
          'Instancia de Evolution creada y vinculada al bot correctamente.';
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isProvisioningEvolution = false;
      notifyListeners();
    }
  }

  Future<void> refreshEvolutionConnection() async {
    _clearBanners();
    _isRefreshingEvolution = true;
    notifyListeners();

    try {
      final token = await _requireToken();
      final response = await _apiClient.getJson(
        '/bot-configuration/evolution/connection',
        token: token,
      );
      _applyEvolutionConnectionResponse(response);
      await _persistLocalBundle();
      _successMessage = 'Estado de Evolution actualizado correctamente.';
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
    } catch (error) {
      _errorMessage = error.toString();
    } finally {
      _isRefreshingEvolution = false;
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
    _scheduleLocalPersist();
  }

  void _applyBundleToControllers() {
    _isApplyingBundleToControllers = true;
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
    _isApplyingBundleToControllers = false;
  }

  void _attachDraftListeners() {
    final draftControllers = <TextEditingController>[
      generalBotNameController,
      generalEnvironmentController,
      evolutionBaseUrlController,
      evolutionInstanceController,
      evolutionApiKeyController,
      evolutionWebhookSecretController,
      evolutionConnectedNumberController,
      openAiApiKeyController,
      openAiTemperatureController,
      openAiMaxTokensController,
      openAiSystemPromptPreviewController,
      memoryWindowSizeController,
      memoryTtlController,
      securityInternalApiTokenController,
      securityWebhookSigningSecretController,
    ];

    for (final controller in draftControllers) {
      controller.addListener(_handleDraftControllerChanged);
    }

    promptContentController.addListener(_handlePromptDraftChanged);
  }

  void _handleDraftControllerChanged() {
    if (_isApplyingBundleToControllers) {
      return;
    }

    _syncDraftsIntoState();

    // Auto-save to backend the section currently being edited.
    _scheduleAutoSaveSection(_selectedSection);
  }

  void _handlePromptDraftChanged() {
    if (_isApplyingBundleToControllers) {
      return;
    }

    updatePromptContent(promptContentController.text);
  }

  void _scheduleLocalPersist() {
    _localPersistTimer?.cancel();
    _localPersistTimer = Timer(_localPersistDebounce, () async {
      try {
        await _persistLocalBundle();
      } catch (_) {
        // Ignore local cache persistence errors.
      }
    });
  }

  void _scheduleAutoSaveSection(BotConfigurationSection section) {
    // Ignore documents section here; it has dedicated per-document patch autosave.
    if (section == BotConfigurationSection.documents) {
      return;
    }

    _pendingSectionAutoSaves.add(section);
    _debounceRemoteAutoSave();
  }

  void _scheduleAutoSaveTool(String toolId) {
    if (toolId.trim().isEmpty) {
      return;
    }
    _pendingToolAutoSaves.add(toolId);
    _debounceRemoteAutoSave();
  }

  void _scheduleAutoSaveDocument(String documentId) {
    if (documentId.trim().isEmpty) {
      return;
    }
    _pendingDocumentAutoSaves.add(documentId);
    _debounceRemoteAutoSave();
  }

  void _scheduleAutoSavePrompt(String promptId) {
    if (promptId.trim().isEmpty) {
      return;
    }
    _pendingPromptAutoSaves.add(promptId);
    _debounceRemoteAutoSave();
  }

  void _debounceRemoteAutoSave() {
    _remoteAutoSaveTimer?.cancel();
    _remoteAutoSaveTimer = Timer(_remoteAutoSaveDebounce, () {
      _flushRemoteAutoSaves();
    });
  }

  Future<void> _flushRemoteAutoSaves() async {
    if (_isFlushingAutoSave) {
      return;
    }

    if (_isLoading || _activeSaveSection != null) {
      return;
    }

    final token = await _tokenStore.read();
    if (token == null || token.trim().isEmpty) {
      return;
    }

    // Capture pending operations and clear early so new edits can schedule again.
    final sections = _pendingSectionAutoSaves.toList(growable: false);
    final tools = _pendingToolAutoSaves.toList(growable: false);
    final documents = _pendingDocumentAutoSaves.toList(growable: false);
    final prompts = _pendingPromptAutoSaves.toList(growable: false);
    _pendingSectionAutoSaves.clear();
    _pendingToolAutoSaves.clear();
    _pendingDocumentAutoSaves.clear();
    _pendingPromptAutoSaves.clear();

    _isFlushingAutoSave = true;
    try {
      _syncDraftsIntoState();

      for (final section in sections) {
        await _saveSectionSilently(section, token);
      }

      for (final promptId in prompts) {
        final prompt = _bundle.prompts
            .where((item) => item.id == promptId)
            .toList(growable: false);
        if (prompt.isEmpty) {
          continue;
        }

        final current = prompt.first;
        await _apiClient.putJson(
          '/bot-configuration/prompts/${current.id}',
          {
            'title': current.title,
            'description': current.description,
            'content': current.content,
          },
          token: token,
        );
      }

      for (final toolId in tools) {
        final tool = _bundle.tools
            .where((item) => item.id == toolId)
            .toList(growable: false);
        if (tool.isEmpty) {
          continue;
        }

        await _apiClient.putJson(
          '/bot-configuration/tools/$toolId',
          {'isEnabled': tool.first.isEnabled},
          token: token,
        );
      }

      for (final documentId in documents) {
        final document = _bundle.documents
            .where((item) => item.id == documentId)
            .toList(growable: false);
        if (document.isEmpty) {
          continue;
        }

        final current = document.first;
        await _apiClient.patchJson(
          '/ai-brain/documents/${current.id}',
          {
            'name': current.name,
            'summary': current.summary,
            'status': current.isEnabled ? current.status : 'disabled',
          },
          token: token,
        );
      }

      await _persistLocalBundle();
    } on BotConfigurationCenterApiException catch (error) {
      _errorMessage = error.message;
      notifyListeners();
    } catch (error) {
      _errorMessage = error.toString();
      notifyListeners();
    } finally {
      _isFlushingAutoSave = false;

      // If new edits arrived during the flush, schedule another pass.
      if (_pendingSectionAutoSaves.isNotEmpty ||
          _pendingToolAutoSaves.isNotEmpty ||
          _pendingDocumentAutoSaves.isNotEmpty ||
          _pendingPromptAutoSaves.isNotEmpty) {
        _debounceRemoteAutoSave();
      }
    }
  }

  Future<void> _saveSectionSilently(
    BotConfigurationSection section,
    String token,
  ) async {
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
        await _saveEvolutionSettings(token);
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
            'enableOperationalMemory': _bundle.memory.enableOperationalMemory,
            'recentMessageWindowSize': _bundle.memory.recentMessageWindowSize,
            'automaticSummarization': _bundle.memory.automaticSummarization,
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
      case BotConfigurationSection.prompts:
      case BotConfigurationSection.tools:
      case BotConfigurationSection.documents:
        // These are handled via per-item autosaves (prompts/tools/documents).
        break;
    }
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

  Future<void> _persistLocalBundle() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_localBundleKey, _encodeLocalBundle());
  }

  @override
  void dispose() {
    _localPersistTimer?.cancel();
    _remoteAutoSaveTimer?.cancel();

    for (final controller in <TextEditingController>[
      generalBotNameController,
      generalEnvironmentController,
      evolutionBaseUrlController,
      evolutionInstanceController,
      evolutionApiKeyController,
      evolutionWebhookSecretController,
      evolutionConnectedNumberController,
      openAiApiKeyController,
      openAiTemperatureController,
      openAiMaxTokensController,
      openAiSystemPromptPreviewController,
      promptContentController,
      memoryWindowSizeController,
      memoryTtlController,
      securityInternalApiTokenController,
      securityWebhookSigningSecretController,
    ]) {
      controller.dispose();
    }

    super.dispose();
  }

  Future<BotConfigurationBundle?> _readLocalBundle() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_localBundleKey);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }

      return BotConfigurationBundleModel.fromBackendJson(
        decoded,
        documents: decoded['documents'] is List<dynamic>
            ? decoded['documents'] as List<dynamic>
            : const <dynamic>[],
      ).toEntity();
    } catch (_) {
      return null;
    }
  }

  String _encodeLocalBundle() {
    return jsonEncode({
      'general': {
        'botName': _bundle.general.botName,
        'defaultLanguage': _bundle.general.defaultLanguage,
        'isEnabled': _bundle.general.isEnabled,
        'environmentLabel': _bundle.general.environmentLabel,
      },
      'evolution': {
        'baseUrl': _bundle.evolutionApi.baseUrl,
        'instanceName': _bundle.evolutionApi.instanceName,
        'apiKey': _bundle.evolutionApi.apiKey,
        'webhookSecret': _bundle.evolutionApi.webhookSecret,
        'connectedNumber': _bundle.evolutionApi.connectedNumber,
        'channelId': _bundle.evolutionApi.channelId,
        'connectionStatus': _bundle.evolutionApi.connectionStatus,
        'provisioningStatus': _bundle.evolutionApi.provisioningStatus,
        'provisioningError': _bundle.evolutionApi.provisioningError,
        'isEnabled': _bundle.evolutionApi.isEnabled,
      },
      'openai': {
        'apiKey': _bundle.openAi.apiKey,
        'model': _bundle.openAi.model,
        'temperature': _bundle.openAi.temperature,
        'maxTokens': _bundle.openAi.maxTokens,
        'isEnabled': _bundle.openAi.isEnabled,
        'systemPromptPreview': _bundle.openAi.systemPromptPreview,
      },
      'memory': {
        'enableShortTermMemory': _bundle.memory.enableShortTermMemory,
        'enableLongTermMemory': _bundle.memory.enableLongTermMemory,
        'enableOperationalMemory': _bundle.memory.enableOperationalMemory,
        'recentMessageWindowSize': _bundle.memory.recentMessageWindowSize,
        'automaticSummarization': _bundle.memory.automaticSummarization,
        'memoryTtl': _bundle.memory.memoryTtl,
        'useRedis': _bundle.memory.useRedis,
        'usePostgreSql': _bundle.memory.usePostgreSql,
      },
      'orchestrator': {
        'automaticMode': _bundle.orchestrator.automaticMode,
        'assistedMode': _bundle.orchestrator.assistedMode,
        'enableRoleDetection': _bundle.orchestrator.enableRoleDetection,
        'enableIntentClassification':
            _bundle.orchestrator.enableIntentClassification,
        'enableToolExecution': _bundle.orchestrator.enableToolExecution,
        'requireConfirmationForCriticalActions':
            _bundle.orchestrator.requireConfirmationForCriticalActions,
        'autonomyLevel': _mapAutonomyLevelToBackend(
          _bundle.orchestrator.autonomyLevel,
        ),
        'fallbackStrategy': _bundle.orchestrator.fallbackStrategy,
      },
      'prompts': _bundle.prompts
          .map(
            (prompt) => {
              'id': prompt.id,
              'title': prompt.title,
              'description': prompt.description,
              'content': prompt.content,
              'updatedAt': prompt.updatedAt.toIso8601String(),
            },
          )
          .toList(growable: false),
      'tools': _bundle.tools
          .map(
            (tool) => {
              'id': tool.id,
              'name': tool.name,
              'description': tool.description,
              'category': tool.category,
              'isEnabled': tool.isEnabled,
            },
          )
          .toList(growable: false),
      'documents': _bundle.documents
          .map(
            (document) => {
              'id': document.id,
              'name': document.name,
              'summary': document.summary,
              'status': document.status,
              'kind': document.kind,
              'sizeLabel': document.sizeLabel,
              'isEnabled': document.isEnabled,
            },
          )
          .toList(growable: false),
      'security': {
        'internalApiToken': _bundle.security.internalApiToken,
        'webhookSigningSecret': _bundle.security.webhookSigningSecret,
        'encryptSecrets': _bundle.security.encryptSecrets,
        'auditLog': _bundle.security.auditLog,
      },
    });
  }

  Future<void> _saveEvolutionSettings(String token) {
    return _apiClient.putJson(
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
  }

  void _applyEvolutionConnectionResponse(Map<String, dynamic> response) {
    _bundle = _bundle.copyWith(
      evolutionApi: _bundle.evolutionApi.copyWith(
        channelId: response['channelId'] as String?,
        instanceName: response['instanceName'] as String? ??
            _bundle.evolutionApi.instanceName,
        connectionStatus: response['connectionStatus'] as String? ??
            _bundle.evolutionApi.connectionStatus,
        provisioningStatus: response['provisioningStatus'] as String? ??
            _bundle.evolutionApi.provisioningStatus,
        provisioningError: response['provisioningError'] as String?,
      ),
    );

    final qrCode = response['qrCode'];
    if (qrCode == null) {
      _evolutionQrPayloadPreview = null;
      _evolutionQrImageBytes = null;
      _evolutionPairingCode = null;
    } else if (qrCode is String) {
      _evolutionQrImageBytes = _tryDecodeQrImage(qrCode);
      _evolutionPairingCode = null;
      _evolutionQrPayloadPreview =
          _evolutionQrImageBytes == null ? qrCode : null;
    } else {
      _evolutionQrImageBytes = _extractQrImageBytes(qrCode);
      _evolutionPairingCode = _extractPairingCode(qrCode);
      _evolutionQrPayloadPreview = const JsonEncoder.withIndent('  ').convert(
        _sanitizeEvolutionQrPayload(qrCode),
      );
    }

    _applyBundleToControllers();
  }

  Uint8List? _extractQrImageBytes(dynamic qrCode) {
    if (qrCode is Map) {
      final candidates = <dynamic>[
        qrCode['base64'],
        qrCode['qrcode'],
        qrCode['qrCode'],
        qrCode['code'],
        qrCode['image'],
        (qrCode['data'] is Map) ? (qrCode['data'] as Map)['base64'] : null,
        (qrCode['data'] is Map) ? (qrCode['data'] as Map)['qrcode'] : null,
        (qrCode['data'] is Map) ? (qrCode['data'] as Map)['qrCode'] : null,
        (qrCode['qrcode'] is Map) ? (qrCode['qrcode'] as Map)['base64'] : null,
        (qrCode['qrCode'] is Map) ? (qrCode['qrCode'] as Map)['base64'] : null,
      ];

      for (final candidate in candidates) {
        final bytes = _tryDecodeQrImage(candidate);
        if (bytes != null) {
          return bytes;
        }
      }
    }

    return null;
  }

  String? _extractPairingCode(dynamic qrCode) {
    if (qrCode is! Map) {
      return null;
    }

    final candidates = <dynamic>[
      qrCode['pairingCode'],
      qrCode['code'],
      qrCode['pairing'],
      (qrCode['data'] is Map) ? (qrCode['data'] as Map)['pairingCode'] : null,
      (qrCode['data'] is Map) ? (qrCode['data'] as Map)['code'] : null,
      (qrCode['qrcode'] is Map)
          ? (qrCode['qrcode'] as Map)['pairingCode']
          : null,
    ];

    for (final candidate in candidates) {
      if (candidate is String && candidate.trim().isNotEmpty) {
        final normalized = candidate.trim();
        if (!_looksLikeBase64Image(normalized)) {
          return normalized;
        }
      }
    }

    return null;
  }

  Uint8List? _tryDecodeQrImage(dynamic value) {
    if (value is! String) {
      return null;
    }

    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    final normalized = trimmed.startsWith('data:image')
        ? trimmed.substring(trimmed.indexOf(',') + 1)
        : trimmed;

    if (!_looksLikeBase64Image(normalized)) {
      return null;
    }

    try {
      return base64Decode(normalized);
    } catch (_) {
      return null;
    }
  }

  bool _looksLikeBase64Image(String value) {
    if (value.length < 100) {
      return false;
    }

    return RegExp(r'^[A-Za-z0-9+/=\r\n]+$').hasMatch(value);
  }

  dynamic _sanitizeEvolutionQrPayload(dynamic value) {
    if (value is Map) {
      return value.map(
        (key, raw) => MapEntry(
          key,
          _shouldMaskQrField(key.toString(), raw)
              ? '<qr-image-hidden>'
              : _sanitizeEvolutionQrPayload(raw),
        ),
      );
    }

    if (value is List) {
      return value.map(_sanitizeEvolutionQrPayload).toList(growable: false);
    }

    return value;
  }

  bool _shouldMaskQrField(String key, dynamic value) {
    final normalizedKey = key.toLowerCase();
    if (value is! String) {
      return false;
    }

    if (!['base64', 'qrcode', 'qr_code', 'image'].contains(normalizedKey)) {
      return false;
    }

    return _tryDecodeQrImage(value) != null;
  }
}
