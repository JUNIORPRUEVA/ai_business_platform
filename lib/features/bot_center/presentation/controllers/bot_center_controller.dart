import 'dart:async';

import 'package:flutter/material.dart';

import '../../data/repositories/bot_center_repository_impl.dart';
import '../../domain/entities/bot_ai_process_result.dart';
import '../../domain/entities/bot_activity_log.dart';
import '../../domain/entities/bot_center_overview.dart';
import '../../domain/entities/bot_contact_context.dart';
import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_memory_item.dart';
import '../../domain/entities/bot_message.dart';
import '../../domain/entities/bot_prompt_config.dart';
import '../../domain/entities/bot_service_status.dart';
import '../../domain/entities/bot_tool.dart';
import '../../domain/repositories/bot_center_repository.dart';

enum BotInspectorSection {
  contact,
  memory,
  tools,
  prompt,
  logs,
  status,
}

class BotCenterController extends ChangeNotifier {
  static const Duration _activeConversationRefreshInterval =
      Duration(milliseconds: 800);
  static const Duration _idleBackgroundRefreshInterval = Duration(seconds: 2);

  BotCenterController({required BotCenterRepository repository})
      : _repository = repository,
        promptTitleController = TextEditingController(),
        promptDescriptionController = TextEditingController(),
        promptEditorController = TextEditingController(),
        messageComposerController = TextEditingController() {
    messageComposerController.addListener(_handleComposerChanged);
  }

  factory BotCenterController.createDefault({
    String? baseUrl,
    Future<String?> Function()? tokenReader,
  }) {
    return BotCenterController(
      repository: BotCenterRepositoryImpl.createDefault(
        baseUrl: baseUrl,
        tokenReader: tokenReader,
      ),
    );
  }

  final BotCenterRepository _repository;

  final TextEditingController messageComposerController;
  final TextEditingController promptTitleController;
  final TextEditingController promptDescriptionController;
  final TextEditingController promptEditorController;

  final List<BotConversation> _conversations = <BotConversation>[];
  final Map<String, List<BotMessage>> _messagesByConversation =
      <String, List<BotMessage>>{};
  final Map<String, BotContactContext> _contactsByConversation =
      <String, BotContactContext>{};
  final Map<String, List<BotMemoryItem>> _memoryByConversation =
      <String, List<BotMemoryItem>>{};
  final List<BotTool> _tools = <BotTool>[];
  final List<BotActivityLog> _activityLogs = <BotActivityLog>[];
  final List<BotServiceStatus> _serviceStatuses = <BotServiceStatus>[];
  Timer? _backgroundRefreshTimer;

  String _selectedConversationId = '';
  String _searchQuery = '';
  String? _errorMessage;
  String? _conversationErrorMessage;
  String? _actionMessage;
  BotConversationStage? _selectedStageFilter;
  BotInspectorSection _selectedInspectorSection = BotInspectorSection.contact;
  BotPromptConfig? _promptConfig;

  bool _isInitialLoading = false;
  bool _isConversationLoading = false;
  bool _isRefreshing = false;
  bool _isSavingPrompt = false;
  bool _isMutatingMemory = false;
  bool _isSendingMessage = false;
  bool _isProcessingWithAi = false;
  bool _hasLoaded = false;

  List<BotConversation> get conversations => List.unmodifiable(_conversations);
  List<BotTool> get tools => List.unmodifiable(_tools);
  List<BotServiceStatus> get serviceStatuses =>
      List.unmodifiable(_serviceStatuses);
  BotConversationStage? get selectedStageFilter => _selectedStageFilter;
  BotInspectorSection get selectedInspectorSection => _selectedInspectorSection;
  String get searchQuery => _searchQuery;
  String get selectedConversationId => _selectedConversationId;
  bool get isInitialLoading => _isInitialLoading;
  bool get isConversationLoading => _isConversationLoading;
  bool get isRefreshing => _isRefreshing;
  bool get isSavingPrompt => _isSavingPrompt;
  bool get isMutatingMemory => _isMutatingMemory;
  bool get isSendingMessage => _isSendingMessage;
  bool get isProcessingWithAi => _isProcessingWithAi;
  bool get hasLoaded => _hasLoaded;
  String? get errorMessage => _errorMessage;
  String? get conversationErrorMessage => _conversationErrorMessage;
  String? get actionMessage => _actionMessage;
  bool get hasDraftMessage => messageComposerController.text.trim().isNotEmpty;

  List<BotConversation> get filteredConversations {
    final normalizedQuery = _searchQuery.trim().toLowerCase();
    final items = _conversations.where((conversation) {
      final matchesFilter = _selectedStageFilter == null ||
          conversation.stage == _selectedStageFilter;
      final matchesQuery = normalizedQuery.isEmpty ||
          conversation.contactName.toLowerCase().contains(normalizedQuery) ||
          conversation.phoneNumber.toLowerCase().contains(normalizedQuery) ||
          conversation.lastMessagePreview
              .toLowerCase()
              .contains(normalizedQuery);
      return matchesFilter && matchesQuery;
    }).toList();

    items.sort((left, right) => right.lastUpdated.compareTo(left.lastUpdated));
    return items;
  }

  BotConversation? get selectedConversationOrNull {
    if (_selectedConversationId.isEmpty) {
      return null;
    }

    for (final conversation in _conversations) {
      if (conversation.id == _selectedConversationId) {
        return conversation;
      }
    }

    return null;
  }

  BotConversation get selectedConversation =>
      selectedConversationOrNull ??
      BotConversation(
        id: 'unavailable',
        contactName: 'No conversation selected',
        phoneNumber: '-',
        lastMessagePreview: '',
        unreadCount: 0,
        stage: BotConversationStage.onboarding,
        lastUpdated: DateTime.fromMillisecondsSinceEpoch(0),
      );

  List<BotMessage> get selectedMessages => List.unmodifiable(
      _messagesByConversation[_selectedConversationId] ?? const <BotMessage>[]);

  BotContactContext get selectedContact =>
      _contactsByConversation[_selectedConversationId] ??
      const BotContactContext(
        name: 'No disponible',
        phoneNumber: '-',
        role: '-',
        businessType: '-',
        city: '-',
        tags: <String>[],
        productKnowledge: <BotProductKnowledge>[],
      );

  List<BotMemoryItem> get selectedMemoryItems =>
      List.unmodifiable(_memoryByConversation[_selectedConversationId] ??
          const <BotMemoryItem>[]);

  List<BotActivityLog> get visibleLogs {
    final items = _activityLogs.where((log) {
      return log.conversationId == null ||
          log.conversationId == _selectedConversationId;
    }).toList();
    items.sort((left, right) => right.timestamp.compareTo(left.timestamp));
    return items;
  }

  BotActivityLog? get latestVisibleLog {
    final logs = visibleLogs;
    if (logs.isEmpty) {
      return null;
    }
    return logs.first;
  }

  BotPromptConfig get promptConfig =>
      _promptConfig ??
      BotPromptConfig(
        title: 'Prompt no disponible',
        description: 'Los datos del prompt aún no se han cargado.',
        content: '',
        lastUpdated: DateTime.now(),
      );

  bool get hasConversationSelection => selectedConversationOrNull != null;

  List<BotMemoryItem> memoryByType(BotMemoryType type) {
    return selectedMemoryItems
        .where((item) => item.type == type)
        .toList(growable: false);
  }

  Future<void> loadInitialData() async {
    _errorMessage = null;
    _actionMessage = null;
    _isInitialLoading = true;
    notifyListeners();

    try {
      final overview = await _repository.getOverview();
      _applyOverview(overview);
      _hasLoaded = true;
      _conversationErrorMessage = null;
      _ensureBackgroundRefresh();
    } catch (error) {
      _errorMessage =
          'No se pudieron cargar los datos del Centro del Bot. ${error.toString()}';
    } finally {
      _isInitialLoading = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh();
      }
      notifyListeners();
    }
  }

  Future<void> refreshModule() async {
    _isRefreshing = true;
    _actionMessage = null;
    notifyListeners();

    try {
      final overview = await _repository.getOverview(
        conversationId:
            _selectedConversationId.isEmpty ? null : _selectedConversationId,
      );
      _applyOverview(overview, preserveDraftMessage: true);
      _actionMessage = 'Datos del Centro del Bot actualizados.';
      _errorMessage = null;
    } catch (error) {
      _actionMessage = null;
      _errorMessage =
          'No se pudieron actualizar los datos del Centro del Bot. ${error.toString()}';
    } finally {
      _isRefreshing = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh();
      }
      notifyListeners();
    }
  }

  Future<void> selectConversation(
    String conversationId, {
    bool forceReload = false,
  }) async {
    if (_selectedConversationId == conversationId &&
        _messagesByConversation.containsKey(conversationId) &&
        !forceReload) {
      return;
    }

    _selectedConversationId = conversationId;
    _conversationErrorMessage = null;
    _actionMessage = null;
    _isConversationLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait<dynamic>([
        _repository.getMessages(conversationId),
        _repository.getContactContext(conversationId),
        _repository.getMemory(conversationId),
      ]);

      final fetchedMessages = results[0] as List<BotMessage>;
      _messagesByConversation[conversationId] =
          _mergeOptimisticMessages(conversationId, fetchedMessages);
      _contactsByConversation[conversationId] = results[1] as BotContactContext;
      _memoryByConversation[conversationId] = results[2] as List<BotMemoryItem>;
    } catch (error) {
      _conversationErrorMessage =
          'No se pudo cargar la conversación seleccionada. ${error.toString()}';
    } finally {
      _isConversationLoading = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh();
      }
      notifyListeners();
    }
  }

  void updateSearchQuery(String value) {
    _searchQuery = value;
    notifyListeners();
  }

  void toggleStageFilter(BotConversationStage? stage) {
    _selectedStageFilter = _selectedStageFilter == stage ? null : stage;
    notifyListeners();
  }

  void selectInspectorSection(BotInspectorSection section) {
    _selectedInspectorSection = section;
    notifyListeners();
  }

  void updatePromptDraft(String value) {
    _promptConfig = promptConfig.copyWith(content: value);
    notifyListeners();
  }

  void updatePromptTitle(String value) {
    _promptConfig = promptConfig.copyWith(title: value);
    notifyListeners();
  }

  void updatePromptDescription(String value) {
    _promptConfig = promptConfig.copyWith(description: value);
    notifyListeners();
  }

  void fillQuickAction(String value) {
    messageComposerController
      ..text = value
      ..selection = TextSelection.collapsed(offset: value.length);
    notifyListeners();
  }

  Future<void> savePromptDraft() async {
    final content = promptEditorController.text.trim();
    if (content.isEmpty) {
      _actionMessage = 'El contenido del prompt no puede estar vacío.';
      notifyListeners();
      return;
    }

    _isSavingPrompt = true;
    _actionMessage = null;
    notifyListeners();

    try {
      final updatedPrompt = await _repository.updatePrompt(
        title: promptTitleController.text.trim(),
        description: promptDescriptionController.text.trim(),
        content: content,
      );

      _promptConfig = updatedPrompt;
      promptEditorController
        ..text = updatedPrompt.content
        ..selection =
            TextSelection.collapsed(offset: updatedPrompt.content.length);

      _activityLogs.insert(
        0,
        BotActivityLog(
          id: 'log-prompt-ui-${DateTime.now().microsecondsSinceEpoch}',
          timestamp: DateTime.now(),
          eventType: 'Prompt sincronizado',
          summary:
              'La configuración del prompt se guardó a través de la capa de repositorio.',
          severity: BotLogSeverity.info,
          conversationId:
              _selectedConversationId.isEmpty ? null : _selectedConversationId,
        ),
      );
      _actionMessage = 'Prompt actualizado correctamente.';
    } catch (error) {
      _actionMessage = 'No se pudo guardar el prompt. ${error.toString()}';
    } finally {
      _isSavingPrompt = false;
      notifyListeners();
    }
  }

  Future<void> createMemoryItem({
    required BotMemoryType type,
    required String title,
    required String content,
  }) async {
    if (_selectedConversationId.isEmpty) {
      return;
    }

    _isMutatingMemory = true;
    _actionMessage = null;
    notifyListeners();

    try {
      await _repository.createMemory(
        conversationId: _selectedConversationId,
        title: title,
        content: content,
        type: type,
      );
      await selectConversation(_selectedConversationId, forceReload: true);
      _actionMessage = 'Memoria creada correctamente.';
    } catch (error) {
      _actionMessage = 'No se pudo crear la memoria. ${error.toString()}';
    } finally {
      _isMutatingMemory = false;
      notifyListeners();
    }
  }

  Future<void> updateMemoryItem({
    required String memoryId,
    required BotMemoryType type,
    required String title,
    required String content,
  }) async {
    if (_selectedConversationId.isEmpty) {
      return;
    }

    _isMutatingMemory = true;
    _actionMessage = null;
    notifyListeners();

    try {
      await _repository.updateMemory(
        conversationId: _selectedConversationId,
        memoryId: memoryId,
        title: title,
        content: content,
        type: type,
      );
      await selectConversation(_selectedConversationId, forceReload: true);
      _actionMessage = 'Memoria actualizada correctamente.';
    } catch (error) {
      _actionMessage = 'No se pudo actualizar la memoria. ${error.toString()}';
    } finally {
      _isMutatingMemory = false;
      notifyListeners();
    }
  }

  Future<void> deleteMemoryItem(String memoryId) async {
    if (_selectedConversationId.isEmpty) {
      return;
    }

    _isMutatingMemory = true;
    _actionMessage = null;
    notifyListeners();

    try {
      await _repository.deleteMemory(
        conversationId: _selectedConversationId,
        memoryId: memoryId,
      );
      await selectConversation(_selectedConversationId, forceReload: true);
      _actionMessage = 'Memoria eliminada correctamente.';
    } catch (error) {
      _actionMessage = 'No se pudo eliminar la memoria. ${error.toString()}';
    } finally {
      _isMutatingMemory = false;
      notifyListeners();
    }
  }

  Future<void> deleteSelectedConversation() async {
    final conversationId = _selectedConversationId;
    if (conversationId.isEmpty) {
      return;
    }

    _isRefreshing = true;
    _actionMessage = null;
    _conversationErrorMessage = null;
    notifyListeners();

    try {
      await _repository.deleteConversation(conversationId);

      _messagesByConversation.remove(conversationId);
      _contactsByConversation.remove(conversationId);
      _memoryByConversation.remove(conversationId);
      _conversations.removeWhere((conversation) => conversation.id == conversationId);
      _activityLogs.removeWhere((log) => log.conversationId == conversationId);

      final nextConversationId =
          _conversations.isEmpty ? '' : _conversations.first.id;
      _selectedConversationId = nextConversationId;

      if (nextConversationId.isNotEmpty) {
        await selectConversation(nextConversationId, forceReload: true);
      } else {
        _conversationErrorMessage = null;
      }

      await _reloadGlobalLists();
      _actionMessage =
          'Contacto y conversaciÃ³n eliminados. Se regenerarÃ¡n con el prÃ³ximo mensaje entrante.';
      _errorMessage = null;
    } catch (error) {
      _actionMessage =
          'No se pudo eliminar el contacto. ${error.toString()}';
    } finally {
      _isRefreshing = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh();
      }
      notifyListeners();
    }
  }

  Future<void> sendDraftMessage() async {
    final text = messageComposerController.text.trim();
    if (text.isEmpty || _selectedConversationId.isEmpty) {
      return;
    }

    final conversationId = _selectedConversationId;
    debugPrint(
        '[BOT_CENTER_UI] sendDraftMessage conversationId=$conversationId length=${text.length}');
    final optimisticMessage = BotMessage(
      id: 'local-outbound-${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      author: BotMessageAuthor.operator,
      body: text,
      timestamp: DateTime.now(),
      state: BotMessageState.queued,
    );

    messageComposerController.clear();
    _appendOptimisticMessage(optimisticMessage);
    _isSendingMessage = true;
    _actionMessage = null;
    notifyListeners();

    try {
      final responseMessage = await _repository.sendTestMessage(
        conversationId: conversationId,
        message: text,
      );

      debugPrint('[BOT_CENTER_UI] sendDraftMessage accepted');

      _updateMessageState(
        conversationId: conversationId,
        messageId: optimisticMessage.id,
        state: BotMessageState.sent,
      );

      await selectConversation(conversationId, forceReload: true);
      await _reloadGlobalLists();
      _actionMessage = responseMessage;
    } catch (error) {
      debugPrint('[BOT_CENTER_UI] sendDraftMessage failed error=$error');
      // Keep the optimistic message visible so it does not “disappear”.
      messageComposerController
        ..text = text
        ..selection = TextSelection.collapsed(offset: text.length);
      _actionMessage =
          'No se pudo enviar el mensaje de prueba. ${error.toString()}';
    } finally {
      _isSendingMessage = false;
      notifyListeners();
    }
  }

  Future<void> processDraftWithAi() async {
    final text = messageComposerController.text.trim();
    if (text.isEmpty || _selectedConversationId.isEmpty) {
      return;
    }

    final conversationId = _selectedConversationId;
    debugPrint(
      '[BOT_CENTER_UI] processDraftWithAi conversationId=$conversationId length=${text.length}',
    );

    messageComposerController.clear();
    _isProcessingWithAi = true;
    _actionMessage = null;
    _conversationErrorMessage = null;
    notifyListeners();

    try {
      final result = await _repository.processAiMessage(
        conversationId: conversationId,
        message: text,
      );
      await _reloadSelectedConversationOverview(conversationId);
      _actionMessage = _aiProcessMessage(result);
      _errorMessage = null;
    } catch (error) {
      messageComposerController
        ..text = text
        ..selection = TextSelection.collapsed(offset: text.length);
      _actionMessage = 'No se pudo ejecutar el cerebro IA. ${error.toString()}';
    } finally {
      _isProcessingWithAi = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh();
      }
      notifyListeners();
    }
  }

  void _appendOptimisticMessage(BotMessage message) {
    final existing =
        _messagesByConversation[message.conversationId] ?? const <BotMessage>[];
    final updated = List<BotMessage>.of(existing, growable: true)..add(message);
    _messagesByConversation[message.conversationId] = updated;

    for (var index = 0; index < _conversations.length; index++) {
      final conversation = _conversations[index];
      if (conversation.id == message.conversationId) {
        _conversations[index] = conversation.copyWith(
          lastMessagePreview: message.body,
          lastUpdated: message.timestamp,
        );
        break;
      }
    }
  }

  void _updateMessageState({
    required String conversationId,
    required String messageId,
    required BotMessageState state,
  }) {
    final existing = _messagesByConversation[conversationId];
    if (existing == null) {
      return;
    }

    final updated = List<BotMessage>.of(existing, growable: true);
    for (var index = 0; index < updated.length; index++) {
      final message = updated[index];
      if (message.id == messageId) {
        updated[index] = BotMessage(
          id: message.id,
          conversationId: message.conversationId,
          author: message.author,
          body: message.body,
          timestamp: message.timestamp,
          state: state,
        );
        _messagesByConversation[conversationId] = updated;
        return;
      }
    }
  }

  void clearActionMessage() {
    if (_actionMessage == null) {
      return;
    }

    _actionMessage = null;
    notifyListeners();
  }

  void _applyOverview(
    BotCenterOverview overview, {
    bool preserveDraftMessage = false,
  }) {
    final currentDraft =
        preserveDraftMessage ? messageComposerController.text : null;

    _conversations
      ..clear()
      ..addAll(overview.conversations);
    _tools
      ..clear()
      ..addAll(overview.tools);
    _activityLogs
      ..clear()
      ..addAll(overview.logs);
    _serviceStatuses
      ..clear()
      ..addAll(overview.statuses);
    _promptConfig = overview.promptConfig;

    if (promptEditorController.text != overview.promptConfig.content) {
      promptEditorController
        ..text = overview.promptConfig.content
        ..selection = TextSelection.collapsed(
            offset: overview.promptConfig.content.length);
    }
    if (promptTitleController.text != overview.promptConfig.title) {
      promptTitleController
        ..text = overview.promptConfig.title
        ..selection = TextSelection.collapsed(
          offset: overview.promptConfig.title.length,
        );
    }
    if (promptDescriptionController.text != overview.promptConfig.description) {
      promptDescriptionController
        ..text = overview.promptConfig.description
        ..selection = TextSelection.collapsed(
          offset: overview.promptConfig.description.length,
        );
    }

    final selectedConversationData = overview.selectedConversationData;
    if (selectedConversationData != null) {
      _selectedConversationId = selectedConversationData.conversation.id;
      _messagesByConversation[_selectedConversationId] =
          _mergeOptimisticMessages(
        _selectedConversationId,
        selectedConversationData.messages,
      );
      _contactsByConversation[_selectedConversationId] =
          selectedConversationData.contact;
      _memoryByConversation[_selectedConversationId] =
          selectedConversationData.memoryItems;
    } else if (_selectedConversationId.isEmpty && _conversations.isNotEmpty) {
      _selectedConversationId = _conversations.first.id;
    }

    if (currentDraft != null && currentDraft.isNotEmpty) {
      messageComposerController
        ..text = currentDraft
        ..selection = TextSelection.collapsed(offset: currentDraft.length);
    }
  }

  Future<void> _reloadGlobalLists() async {
    try {
      final results = await Future.wait<dynamic>([
        _repository.getConversations(),
        _repository.getLogs(),
      ]);

      _conversations
        ..clear()
        ..addAll(results[0] as List<BotConversation>);
      _activityLogs
        ..clear()
        ..addAll(results[1] as List<BotActivityLog>);
    } catch (_) {
      // Keep the latest local state if a secondary refresh fails.
    }
  }

  Future<void> _reloadSelectedConversationOverview(
      String conversationId) async {
    final overview =
        await _repository.getOverview(conversationId: conversationId);
    _applyOverview(overview);
    _conversationErrorMessage = null;
  }

  String _aiProcessMessage(BotAiProcessResult result) {
    if (!result.ok) {
      return 'El cerebro IA no pudo completar la ejecución.';
    }

    if (result.queued) {
      return 'El mensaje se encoló para el cerebro IA. Id ${result.messageId}.';
    }

    return 'El cerebro IA procesó el mensaje y actualizó la conversación.';
  }

  void _handleComposerChanged() {
    notifyListeners();
  }

  Duration get _nextBackgroundRefreshInterval {
    return _selectedConversationId.isEmpty
        ? _idleBackgroundRefreshInterval
        : _activeConversationRefreshInterval;
  }

  void _ensureBackgroundRefresh() {
    if (_backgroundRefreshTimer != null) {
      return;
    }

    _scheduleNextBackgroundRefresh();
  }

  void _scheduleNextBackgroundRefresh({Duration? delay}) {
    _backgroundRefreshTimer?.cancel();

    if (!_hasLoaded) {
      _backgroundRefreshTimer = null;
      return;
    }

    _backgroundRefreshTimer =
        Timer(delay ?? _nextBackgroundRefreshInterval, () {
      unawaited(_silentRefresh());
    });
  }

  Future<void> _silentRefresh() async {
    if (!_hasLoaded ||
        _isInitialLoading ||
        _isRefreshing ||
        _isConversationLoading) {
      _scheduleNextBackgroundRefresh();
      return;
    }

    try {
      final results = await Future.wait<dynamic>([
        _repository.getConversations(),
        _repository.getLogs(),
      ]);

      final refreshedConversations = results[0] as List<BotConversation>;
      final refreshedLogs = results[1] as List<BotActivityLog>;
      final nextSelectedConversationId =
          _resolveBackgroundSelectedConversationId(refreshedConversations);

      _conversations
        ..clear()
        ..addAll(refreshedConversations);
      _activityLogs
        ..clear()
        ..addAll(refreshedLogs);

      if (nextSelectedConversationId == null) {
        _selectedConversationId = '';
      } else {
        final conversationResults = await Future.wait<dynamic>([
          _repository.getMessages(nextSelectedConversationId),
          _repository.getContactContext(nextSelectedConversationId),
          _repository.getMemory(nextSelectedConversationId),
        ]);

        _selectedConversationId = nextSelectedConversationId;
        final refreshedMessages = conversationResults[0] as List<BotMessage>;
        _messagesByConversation[nextSelectedConversationId] =
            _mergeOptimisticMessages(
                nextSelectedConversationId, refreshedMessages);
        _contactsByConversation[nextSelectedConversationId] =
            conversationResults[1] as BotContactContext;
        _memoryByConversation[nextSelectedConversationId] =
            conversationResults[2] as List<BotMemoryItem>;
      }

      _errorMessage = null;
      _conversationErrorMessage = null;
      notifyListeners();
    } catch (_) {
      // Preserve the current UI state if a background sync fails.
    } finally {
      _scheduleNextBackgroundRefresh();
    }
  }

  String? _resolveBackgroundSelectedConversationId(
    List<BotConversation> conversations,
  ) {
    if (conversations.isEmpty) {
      return null;
    }

    if (_selectedConversationId.isEmpty) {
      return conversations.first.id;
    }

    for (final conversation in conversations) {
      if (conversation.id == _selectedConversationId) {
        return _selectedConversationId;
      }
    }

    return conversations.first.id;
  }

  List<BotMessage> _mergeOptimisticMessages(
    String conversationId,
    List<BotMessage> fetched,
  ) {
    final existing =
        _messagesByConversation[conversationId] ?? const <BotMessage>[];
    final fetchedGrowable = List<BotMessage>.of(fetched, growable: true);
    final optimistic = existing
        .where(
          (message) =>
              message.author == BotMessageAuthor.operator &&
              (message.state == BotMessageState.queued ||
                  message.id.startsWith('local-outbound-')),
        )
        .toList(growable: false);

    if (optimistic.isEmpty) {
      return fetchedGrowable;
    }

    final merged = <BotMessage>[...fetchedGrowable];

    for (final optimisticMessage in optimistic) {
      final alreadyPresent = fetched.any((remoteMessage) {
        if (remoteMessage.author != BotMessageAuthor.operator) {
          return false;
        }
        if (remoteMessage.body.trim() != optimisticMessage.body.trim()) {
          return false;
        }
        final deltaSeconds = remoteMessage.timestamp
            .difference(optimisticMessage.timestamp)
            .inSeconds
            .abs();
        return deltaSeconds <= 120;
      });

      if (!alreadyPresent) {
        merged.add(optimisticMessage);
      }
    }

    merged.sort((left, right) => left.timestamp.compareTo(right.timestamp));
    return merged;
  }

  @override
  void dispose() {
    _backgroundRefreshTimer?.cancel();
    messageComposerController.removeListener(_handleComposerChanged);
    messageComposerController.dispose();
    promptTitleController.dispose();
    promptDescriptionController.dispose();
    promptEditorController.dispose();
    super.dispose();
  }
}
