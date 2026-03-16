import 'package:flutter/material.dart';

import '../../data/repositories/bot_center_repository_impl.dart';
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
  BotCenterController({required BotCenterRepository repository})
      : _repository = repository,
        promptEditorController = TextEditingController(),
        messageComposerController = TextEditingController();

  factory BotCenterController.createDefault({String? baseUrl}) {
    return BotCenterController(
      repository: BotCenterRepositoryImpl.createDefault(baseUrl: baseUrl),
    );
  }

  final BotCenterRepository _repository;

  final TextEditingController messageComposerController;
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
  bool _isSendingMessage = false;
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
  bool get isSendingMessage => _isSendingMessage;
  bool get hasLoaded => _hasLoaded;
  String? get errorMessage => _errorMessage;
  String? get conversationErrorMessage => _conversationErrorMessage;
  String? get actionMessage => _actionMessage;

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
    } catch (error) {
      _errorMessage =
          'No se pudieron cargar los datos del Centro del Bot. ${error.toString()}';
    } finally {
      _isInitialLoading = false;
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
      notifyListeners();
    }
  }

  Future<void> selectConversation(String conversationId) async {
    if (_selectedConversationId == conversationId &&
        _messagesByConversation.containsKey(conversationId)) {
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

      _messagesByConversation[conversationId] = results[0] as List<BotMessage>;
      _contactsByConversation[conversationId] = results[1] as BotContactContext;
      _memoryByConversation[conversationId] = results[2] as List<BotMemoryItem>;
    } catch (error) {
      _conversationErrorMessage =
          'No se pudo cargar la conversación seleccionada. ${error.toString()}';
    } finally {
      _isConversationLoading = false;
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
        title: promptConfig.title,
        description: promptConfig.description,
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

  Future<void> sendDraftMessage() async {
    final text = messageComposerController.text.trim();
    if (text.isEmpty || _selectedConversationId.isEmpty) {
      return;
    }

    _isSendingMessage = true;
    _actionMessage = null;
    notifyListeners();

    try {
      final responseMessage = await _repository.sendTestMessage(
        conversationId: _selectedConversationId,
        message: text,
      );

      messageComposerController.clear();
      await selectConversation(_selectedConversationId);
      await _reloadGlobalLists();
      _actionMessage = responseMessage;
    } catch (error) {
      _actionMessage =
          'No se pudo enviar el mensaje de prueba. ${error.toString()}';
    } finally {
      _isSendingMessage = false;
      notifyListeners();
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

    final selectedConversationData = overview.selectedConversationData;
    if (selectedConversationData != null) {
      _selectedConversationId = selectedConversationData.conversation.id;
      _messagesByConversation[_selectedConversationId] =
          selectedConversationData.messages;
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

  @override
  void dispose() {
    messageComposerController.dispose();
    promptEditorController.dispose();
    super.dispose();
  }
}
