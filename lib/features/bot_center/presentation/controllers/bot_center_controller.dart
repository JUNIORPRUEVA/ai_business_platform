import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:record/record.dart';

import '../../data/repositories/bot_center_repository_impl.dart';
import '../../domain/entities/bot_ai_process_result.dart';
import '../../domain/entities/bot_activity_log.dart';
import '../../domain/entities/bot_center_overview.dart';
import '../../domain/entities/bot_contact_context.dart';
import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_memory_item.dart';
import '../../domain/entities/bot_message.dart';
import '../../domain/entities/bot_prompt_config.dart';
import '../../domain/entities/bot_realtime_event.dart';
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
  static const Duration _pollingActiveConversationRefreshInterval =
      Duration(milliseconds: 800);
  static const Duration _pollingIdleBackgroundRefreshInterval =
      Duration(seconds: 2);
  static const Duration _realtimeActiveFallbackRefreshInterval =
      Duration(seconds: 8);
  static const Duration _realtimeIdleFallbackRefreshInterval =
      Duration(seconds: 15);
  static const Duration _realtimeReconnectDelay = Duration(seconds: 3);

  BotCenterController({required BotCenterRepository repository})
      : _repository = repository,
        _audioRecorder = AudioRecorder(),
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
  final AudioRecorder _audioRecorder;

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
  final Map<String, Future<void>> _mediaLoads = <String, Future<void>>{};
  Timer? _realtimeReconnectTimer;
  StreamSubscription<BotRealtimeEvent>? _realtimeSubscription;
  Timer? _backgroundRefreshTimer;
  Timer? _recordingTicker;
  StreamSubscription<Amplitude>? _recordingAmplitudeSubscription;

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
  bool _isRealtimeConnected = false;
  bool _hasLoaded = false;
  bool _isRecordingAudio = false;
  bool _isPreparingAudio = false;
  Duration _recordingDuration = Duration.zero;
  double _recordingLevel = 0;
  String? _recordingFilePath;

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
  bool get isRealtimeConnected => _isRealtimeConnected;
  bool get isRecordingAudio => _isRecordingAudio;
  bool get isPreparingAudio => _isPreparingAudio;
  Duration get recordingDuration => _recordingDuration;
  double get recordingLevel => _recordingLevel;
  String? get errorMessage => _errorMessage;
  String? get conversationErrorMessage => _conversationErrorMessage;
  String? get actionMessage => _actionMessage;
  bool get hasDraftMessage => messageComposerController.text.trim().isNotEmpty;
  bool get canStartAudioRecording =>
      hasConversationSelection &&
      !_isSendingMessage &&
      !_isProcessingWithAi &&
      !_isPreparingAudio &&
      !_isRecordingAudio;

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
        (_messagesByConversation[_selectedConversationId] ??
                const <BotMessage>[])
            .where(
          (message) => message.conversationId == _selectedConversationId,
        ),
      );

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
      _ensureRealtimeConnection();
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
      _primeMediaPreviewsForConversation(conversationId);
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
      _conversations
          .removeWhere((conversation) => conversation.id == conversationId);
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
      _actionMessage = 'No se pudo eliminar el contacto. ${error.toString()}';
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
      type: BotMessageType.text,
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
        updated[index] = message.copyWith(state: state);
        _messagesByConversation[conversationId] = updated;
        return;
      }
    }
  }

  Future<void> pickAndSendMedia(BotMessageType type) async {
    if (_selectedConversationId.isEmpty ||
        _isSendingMessage ||
        _isProcessingWithAi ||
        (type != BotMessageType.image && type != BotMessageType.video)) {
      return;
    }

    final picked = await _pickMedia(type);
    if (picked == null) {
      return;
    }

    final caption = messageComposerController.text.trim();
    if (caption.isNotEmpty) {
      messageComposerController.clear();
    }

    await _sendMediaPayload(
      conversationId: _selectedConversationId,
      type: type,
      bytes: picked.bytes,
      previewBytes: picked.previewBytes,
      fileName: picked.fileName,
      mimeType: picked.mimeType,
      caption: caption,
    );
  }

  Future<void> retryFailedMessage(BotMessage message) async {
    if (!message.canRetry || _isSendingMessage || _isProcessingWithAi) {
      return;
    }

    await _sendMediaPayload(
      conversationId: message.conversationId,
      type: message.type,
      bytes: message.localFileBytes!,
      previewBytes: message.localPreviewBytes,
      fileName: message.fileName ?? 'archivo',
      mimeType: message.mimeType ?? 'application/octet-stream',
      caption: message.caption ?? '',
      durationSeconds: message.durationSeconds,
      replaceMessageId: message.id,
    );
  }

  Future<void> startAudioRecording() async {
    if (!canStartAudioRecording) {
      return;
    }

    try {
      final hasPermission = await _audioRecorder.hasPermission();
      if (!hasPermission) {
        _actionMessage =
            'No se pudo acceder al micrófono. Revisa los permisos del sistema.';
        notifyListeners();
        return;
      }

      final directory =
          await Directory.systemTemp.createTemp('bot-center-voice-note-');
      final filePath =
          '${directory.path}${Platform.pathSeparator}voice-${DateTime.now().millisecondsSinceEpoch}.m4a';

      await _audioRecorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 24000,
          numChannels: 1,
        ),
        path: filePath,
      );

      _recordingFilePath = filePath;
      _recordingDuration = Duration.zero;
      _recordingLevel = 0;
      _isRecordingAudio = true;
      _isPreparingAudio = false;
      _actionMessage = null;

      _recordingTicker?.cancel();
      _recordingTicker = Timer.periodic(
        const Duration(milliseconds: 200),
        (_) {
          _recordingDuration += const Duration(milliseconds: 200);
          notifyListeners();
        },
      );

      _recordingAmplitudeSubscription?.cancel();
      _recordingAmplitudeSubscription = _audioRecorder
          .onAmplitudeChanged(const Duration(milliseconds: 120))
          .listen((amplitude) {
        _recordingLevel =
            (((amplitude.current + 60) / 60).clamp(0.12, 1.0)).toDouble();
        notifyListeners();
      });

      notifyListeners();
    } catch (error) {
      _clearRecordingUiState();
      _actionMessage = 'No se pudo iniciar la grabación. ${error.toString()}';
      await _deleteRecordingFile(_recordingFilePath);
      notifyListeners();
    }
  }

  Future<void> finishAudioRecording({bool cancel = false}) async {
    if (!_isRecordingAudio && !_isPreparingAudio) {
      return;
    }

    final recordingPath = _recordingFilePath;
    final elapsed = _recordingDuration;

    _recordingTicker?.cancel();
    _recordingTicker = null;
    await _recordingAmplitudeSubscription?.cancel();
    _recordingAmplitudeSubscription = null;

    if (cancel) {
      try {
        await _audioRecorder.cancel();
      } catch (_) {
        // Ignore recorder cleanup failures.
      }
      _clearRecordingUiState();
      await _deleteRecordingFile(recordingPath);
      notifyListeners();
      return;
    }

    _isRecordingAudio = false;
    _isPreparingAudio = true;
    _recordingLevel = 0;
    notifyListeners();

    try {
      final stoppedPath = await _audioRecorder.stop();
      final resolvedPath = stoppedPath ?? recordingPath;
      if (resolvedPath == null || resolvedPath.isEmpty) {
        throw StateError('No se generó ningún archivo de audio.');
      }

      if (elapsed.inMilliseconds < 500) {
        _actionMessage = 'La nota de voz es demasiado corta.';
        return;
      }

      final audioFile = File(resolvedPath);
      final bytes = Uint8List.fromList(await audioFile.readAsBytes());
      final durationSeconds = math.max(1, elapsed.inMilliseconds ~/ 1000);

      await _sendMediaPayload(
        conversationId: _selectedConversationId,
        type: BotMessageType.audio,
        bytes: bytes,
        previewBytes: null,
        fileName: 'voice-note-${DateTime.now().millisecondsSinceEpoch}.m4a',
        mimeType: 'audio/mp4',
        caption: '',
        durationSeconds: durationSeconds,
      );
    } catch (error) {
      _actionMessage =
          'No se pudo procesar la nota de voz. ${error.toString()}';
    } finally {
      _clearRecordingUiState();
      await _deleteRecordingFile(recordingPath);
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

  BotMessage? findMessageById(String conversationId, String messageId) {
    final messages = _messagesByConversation[conversationId];
    if (messages == null) {
      return null;
    }

    for (final message in messages) {
      if (message.id == messageId) {
        return message;
      }
    }

    return null;
  }

  Future<void> ensureMessagePreviewLoaded(BotMessage message) {
    if (!message.hasVisualMedia || message.localPreviewBytes != null) {
      return Future.value();
    }

    return _enqueueMediaLoad(
      message,
      thumbnailOnly: true,
      assignToPreview: true,
      assignToFile: false,
    );
  }

  Future<void> ensureMessagePlayableLoaded(BotMessage message) {
    if (!message.hasDownloadableAsset || message.localFileBytes != null) {
      return Future.value();
    }

    return _enqueueMediaLoad(
      message,
      thumbnailOnly: false,
      assignToPreview: message.isImage,
      assignToFile: true,
    );
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
      _primeMediaPreviewsForConversation(_selectedConversationId);
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

  void _ensureRealtimeConnection() {
    if (!_hasLoaded || _realtimeSubscription != null) {
      return;
    }

    _realtimeReconnectTimer?.cancel();
    _realtimeSubscription = _repository.connectRealtime().listen(
          _handleRealtimeEvent,
          onError: (_) => _handleRealtimeDisconnect(),
          onDone: _handleRealtimeDisconnect,
          cancelOnError: false,
        );
    _isRealtimeConnected = true;
  }

  void _handleRealtimeDisconnect() {
    _realtimeSubscription = null;
    if (_isRealtimeConnected) {
      _isRealtimeConnected = false;
      if (_hasLoaded) {
        _scheduleNextBackgroundRefresh(delay: Duration.zero);
      }
      notifyListeners();
    }

    if (!_hasLoaded) {
      return;
    }

    _realtimeReconnectTimer?.cancel();
    _realtimeReconnectTimer = Timer(_realtimeReconnectDelay, () {
      _realtimeReconnectTimer = null;
      _ensureRealtimeConnection();
    });
  }

  void _handleRealtimeEvent(BotRealtimeEvent event) {
    if (!event.hasMessageUpdate ||
        event.message == null ||
        event.conversation == null) {
      return;
    }

    final conversation = event.conversation!;
    final message = event.message!;
    _upsertConversation(conversation);
    _upsertRealtimeMessage(message);
    unawaited(ensureMessagePreviewLoaded(message));

    if (message.author == BotMessageAuthor.contact &&
        event.event == 'message.upsert' &&
        message.conversationId == _selectedConversationId) {
      unawaited(_playIncomingMessageSound());
    }

    notifyListeners();
  }

  void _upsertConversation(BotConversation conversation) {
    final index =
        _conversations.indexWhere((item) => item.id == conversation.id);
    if (index >= 0) {
      _conversations[index] = conversation;
    } else {
      _conversations.insert(0, conversation);
    }

    _conversations
        .sort((left, right) => right.lastUpdated.compareTo(left.lastUpdated));
  }

  void _upsertRealtimeMessage(BotMessage message) {
    final existing = List<BotMessage>.of(
      _messagesByConversation[message.conversationId] ?? const <BotMessage>[],
      growable: true,
    );

    final exactIndex = existing.indexWhere((item) => item.id == message.id);
    if (exactIndex >= 0) {
      existing[exactIndex] = _mergeMediaPresentation(
        existing[exactIndex],
        existing[exactIndex].copyWith(
          author: message.author,
          body: message.body,
          type: message.type,
          timestamp: message.timestamp,
          state: message.state,
          caption: message.caption,
          mediaUrl: message.mediaUrl,
          thumbnailUrl: message.thumbnailUrl,
          mimeType: message.mimeType,
          fileName: message.fileName,
        ),
      );
    } else {
      final optimisticIndex = existing.indexWhere((item) {
        if (item.author != message.author) {
          return false;
        }
        if (item.body.trim() != message.body.trim()) {
          return false;
        }

        final delta =
            item.timestamp.difference(message.timestamp).inSeconds.abs();
        return delta <= 120 && item.id.startsWith('local-outbound-');
      });

      if (optimisticIndex >= 0) {
        existing[optimisticIndex] = _mergeMediaPresentation(
          existing[optimisticIndex],
          message.copyWith(
            localPreviewBytes: existing[optimisticIndex].localPreviewBytes,
            localFileBytes: existing[optimisticIndex].localFileBytes,
          ),
        );
      } else {
        existing.add(message);
      }
    }

    existing.sort((left, right) => left.timestamp.compareTo(right.timestamp));
    _messagesByConversation[message.conversationId] = existing;
  }

  Duration get _nextBackgroundRefreshInterval {
    if (_isRealtimeConnected) {
      return _selectedConversationId.isEmpty
          ? _realtimeIdleFallbackRefreshInterval
          : _realtimeActiveFallbackRefreshInterval;
    }

    return _selectedConversationId.isEmpty
        ? _pollingIdleBackgroundRefreshInterval
        : _pollingActiveConversationRefreshInterval;
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

    final previousUnreadCounts = <String, int>{
      for (final conversation in _conversations)
        conversation.id: conversation.unreadCount,
    };
    final previousSelectedConversationId = _selectedConversationId;
    final previousSelectedMessages = List<BotMessage>.of(
      _messagesByConversation[previousSelectedConversationId] ??
          const <BotMessage>[],
      growable: false,
    );

    try {
      final results = await Future.wait<dynamic>([
        _repository.getConversations(),
        _repository.getLogs(),
      ]);

      final refreshedConversations = results[0] as List<BotConversation>;
      final refreshedLogs = results[1] as List<BotActivityLog>;
      final nextSelectedConversationId =
          _resolveBackgroundSelectedConversationId(refreshedConversations);
      var shouldPlayIncomingSound = _hasIncomingUnreadDelta(
        previousUnreadCounts: previousUnreadCounts,
        refreshedConversations: refreshedConversations,
      );

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
        shouldPlayIncomingSound = shouldPlayIncomingSound ||
            _hasIncomingMessageDelta(
              previousSelectedConversationId: previousSelectedConversationId,
              nextSelectedConversationId: nextSelectedConversationId,
              previousSelectedMessages: previousSelectedMessages,
              refreshedMessages: refreshedMessages,
            );
        _messagesByConversation[nextSelectedConversationId] =
            _mergeOptimisticMessages(
                nextSelectedConversationId, refreshedMessages);
        _contactsByConversation[nextSelectedConversationId] =
            conversationResults[1] as BotContactContext;
        _memoryByConversation[nextSelectedConversationId] =
            conversationResults[2] as List<BotMemoryItem>;
        _primeMediaPreviewsForConversation(nextSelectedConversationId);
      }

      _errorMessage = null;
      _conversationErrorMessage = null;
      notifyListeners();

      if (shouldPlayIncomingSound) {
        unawaited(_playIncomingMessageSound());
      }
    } catch (_) {
      // Preserve the current UI state if a background sync fails.
    } finally {
      _scheduleNextBackgroundRefresh();
    }
  }

  bool _hasIncomingUnreadDelta({
    required Map<String, int> previousUnreadCounts,
    required List<BotConversation> refreshedConversations,
  }) {
    for (final conversation in refreshedConversations) {
      final previousUnread = previousUnreadCounts[conversation.id] ?? 0;
      if (conversation.unreadCount > previousUnread) {
        return true;
      }
    }

    return false;
  }

  bool _hasIncomingMessageDelta({
    required String previousSelectedConversationId,
    required String nextSelectedConversationId,
    required List<BotMessage> previousSelectedMessages,
    required List<BotMessage> refreshedMessages,
  }) {
    if (previousSelectedConversationId.isEmpty ||
        previousSelectedConversationId != nextSelectedConversationId) {
      return false;
    }

    final previousIncomingIds = previousSelectedMessages
        .where((message) => message.isIncoming)
        .map((message) => message.id)
        .toSet();

    for (final message in refreshedMessages) {
      if (message.isIncoming && !previousIncomingIds.contains(message.id)) {
        return true;
      }
    }

    return false;
  }

  Future<void> _playIncomingMessageSound() async {
    try {
      await SystemSound.play(SystemSoundType.alert);
    } catch (_) {
      // Skip audio feedback if the current platform does not expose system sounds.
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
        (_messagesByConversation[conversationId] ?? const <BotMessage>[])
            .where((message) => message.conversationId == conversationId)
            .toList(growable: false);
    final fetchedGrowable = fetched
        .where((message) => message.conversationId == conversationId)
        .toList(growable: true);
    final optimistic = existing
        .where(
          (message) =>
              message.author == BotMessageAuthor.operator &&
              (message.state == BotMessageState.queued ||
                  message.state == BotMessageState.failed ||
                  message.id.startsWith('local-outbound-')),
        )
        .toList(growable: false);

    if (optimistic.isEmpty) {
      return fetchedGrowable;
    }

    final merged = <BotMessage>[...fetchedGrowable];

    for (final optimisticMessage in optimistic) {
      final matchedIndex = merged.indexWhere((remoteMessage) {
        if (remoteMessage.author != BotMessageAuthor.operator) {
          return false;
        }
        if (remoteMessage.type != optimisticMessage.type) {
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

      if (matchedIndex >= 0) {
        merged[matchedIndex] = _mergeMediaPresentation(
          optimisticMessage,
          merged[matchedIndex],
        );
      } else {
        merged.add(optimisticMessage);
      }
    }

    merged.sort((left, right) => left.timestamp.compareTo(right.timestamp));
    return merged;
  }

  Future<void> _sendMediaPayload({
    required String conversationId,
    required BotMessageType type,
    required Uint8List bytes,
    required Uint8List? previewBytes,
    required String fileName,
    required String mimeType,
    required String caption,
    int? durationSeconds,
    String? replaceMessageId,
  }) async {
    final optimisticId = replaceMessageId ??
        'local-outbound-media-${DateTime.now().microsecondsSinceEpoch}';
    final optimisticMessage = BotMessage(
      id: optimisticId,
      conversationId: conversationId,
      author: BotMessageAuthor.operator,
      body: caption.isNotEmpty
          ? caption
          : type == BotMessageType.image
              ? 'Imagen enviada'
              : type == BotMessageType.video
                  ? 'Video enviado'
                  : 'Audio enviado',
      type: type,
      timestamp: DateTime.now(),
      state: BotMessageState.queued,
      caption: caption.isNotEmpty ? caption : null,
      mimeType: mimeType,
      fileName: fileName,
      durationSeconds: durationSeconds,
      localPreviewBytes: previewBytes,
      localFileBytes: bytes,
    );

    if (replaceMessageId == null) {
      _appendOptimisticMessage(optimisticMessage);
    } else {
      _replaceMessage(conversationId, optimisticId, optimisticMessage);
    }

    _isSendingMessage = true;
    _actionMessage = null;
    notifyListeners();

    try {
      final sentMessage = await _repository.sendMediaMessage(
        conversationId: conversationId,
        bytes: bytes,
        fileName: fileName,
        mimeType: mimeType,
        mediaType: type,
        caption: caption.isEmpty ? null : caption,
        durationSeconds: durationSeconds,
      );

      _replaceMessage(
        conversationId,
        optimisticId,
        _mergeMediaPresentation(
          optimisticMessage,
          sentMessage.copyWith(
            clearLocalFileBytes: true,
          ),
        ),
      );
      await selectConversation(conversationId, forceReload: true);
      await _reloadGlobalLists();
      _actionMessage = switch (type) {
        BotMessageType.image => 'Imagen enviada.',
        BotMessageType.video => 'Video enviado.',
        BotMessageType.audio => 'Nota de voz enviada.',
        _ => 'Archivo enviado.',
      };
    } catch (error) {
      _replaceMessage(
        conversationId,
        optimisticId,
        optimisticMessage.copyWith(state: BotMessageState.failed),
      );
      _actionMessage = 'No se pudo enviar el archivo. ${error.toString()}';
    } finally {
      _isSendingMessage = false;
      notifyListeners();
    }
  }

  Future<_PickedMedia?> _pickMedia(BotMessageType type) async {
    final allowedExtensions = type == BotMessageType.image
        ? const ['jpg', 'jpeg', 'png', 'webp']
        : const ['mp4', 'mov', 'm4v', 'webm'];
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: allowedExtensions,
      withData: true,
    );

    final file = picked?.files.single;
    final rawBytes = file?.bytes;
    if (file == null || rawBytes == null || rawBytes.isEmpty) {
      return null;
    }

    if (type == BotMessageType.video && rawBytes.length > 20 * 1024 * 1024) {
      _actionMessage =
          'El video supera 20 MB. Selecciona un archivo más liviano para evitar fallos de carga.';
      notifyListeners();
      return null;
    }

    if (type == BotMessageType.image) {
      final compressed = _compressImage(rawBytes, file.name);
      return _PickedMedia(
        bytes: compressed.bytes,
        previewBytes: compressed.previewBytes,
        fileName: compressed.fileName,
        mimeType: compressed.mimeType,
      );
    }

    return _PickedMedia(
      bytes: rawBytes,
      previewBytes: null,
      fileName: file.name,
      mimeType: _inferMimeType(file.name, fallback: 'video/mp4'),
    );
  }

  _CompressedImage _compressImage(Uint8List rawBytes, String fileName) {
    final decoded = img.decodeImage(rawBytes);
    if (decoded == null) {
      return _CompressedImage(
        bytes: rawBytes,
        previewBytes: rawBytes,
        fileName: fileName,
        mimeType: _inferMimeType(fileName, fallback: 'image/jpeg'),
      );
    }

    final resized = decoded.width > 1600 || decoded.height > 1600
        ? img.copyResize(
            decoded,
            width: decoded.width >= decoded.height ? 1600 : null,
            height: decoded.height > decoded.width ? 1600 : null,
          )
        : decoded;

    final lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.png')) {
      final encoded = Uint8List.fromList(img.encodePng(resized, level: 6));
      return _CompressedImage(
        bytes: encoded,
        previewBytes: encoded,
        fileName: fileName,
        mimeType: 'image/png',
      );
    }

    final encoded = Uint8List.fromList(img.encodeJpg(resized, quality: 82));
    final normalizedName =
        lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
            ? fileName
            : '${fileName.replaceAll(RegExp(r'\.[^.]+$'), '')}.jpg';
    return _CompressedImage(
      bytes: encoded,
      previewBytes: encoded,
      fileName: normalizedName,
      mimeType: 'image/jpeg',
    );
  }

  String _inferMimeType(String fileName, {required String fallback}) {
    final normalized = fileName.toLowerCase();
    if (normalized.endsWith('.png')) {
      return 'image/png';
    }
    if (normalized.endsWith('.webp')) {
      return 'image/webp';
    }
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (normalized.endsWith('.mov')) {
      return 'video/quicktime';
    }
    if (normalized.endsWith('.webm')) {
      return 'video/webm';
    }
    if (normalized.endsWith('.mp4') || normalized.endsWith('.m4v')) {
      return 'video/mp4';
    }
    return fallback;
  }

  void _replaceMessage(
    String conversationId,
    String messageId,
    BotMessage replacement,
  ) {
    final existing = _messagesByConversation[conversationId];
    if (existing == null) {
      _messagesByConversation[conversationId] = [replacement];
      return;
    }

    final updated = List<BotMessage>.of(existing, growable: true);
    for (var index = 0; index < updated.length; index++) {
      if (updated[index].id == messageId) {
        updated[index] = replacement;
        _messagesByConversation[conversationId] = updated;
        return;
      }
    }

    updated.add(replacement);
    _messagesByConversation[conversationId] = updated;
  }

  Future<void> _enqueueMediaLoad(
    BotMessage message, {
    required bool thumbnailOnly,
    required bool assignToPreview,
    required bool assignToFile,
  }) {
    final key = '${message.id}:${thumbnailOnly ? 'thumb' : 'media'}';
    final existing = _mediaLoads[key];
    if (existing != null) {
      return existing;
    }

    final future = _loadMediaBytes(
      message,
      thumbnailOnly: thumbnailOnly,
      assignToPreview: assignToPreview,
      assignToFile: assignToFile,
    ).whenComplete(() => _mediaLoads.remove(key));
    _mediaLoads[key] = future;
    return future;
  }

  Future<void> _loadMediaBytes(
    BotMessage message, {
    required bool thumbnailOnly,
    required bool assignToPreview,
    required bool assignToFile,
  }) async {
    try {
      final bytes = await _repository.fetchMessageAssetBytes(
        conversationId: message.conversationId,
        messageId: message.id,
        thumbnailOnly: thumbnailOnly,
      );

      final current = findMessageById(message.conversationId, message.id);
      if (current == null) {
        return;
      }

      _replaceMessage(
        current.conversationId,
        current.id,
        current.copyWith(
          localPreviewBytes:
              assignToPreview ? bytes : current.localPreviewBytes,
          localFileBytes: assignToFile ? bytes : current.localFileBytes,
        ),
      );
      notifyListeners();
    } catch (_) {
      // Keep existing state; widgets can still fall back to remote URLs if available.
    }
  }

  void _primeMediaPreviewsForConversation(String conversationId) {
    final messages = _messagesByConversation[conversationId];
    if (messages == null || messages.isEmpty) {
      return;
    }

    for (final message in messages) {
      if (message.hasVisualMedia && message.localPreviewBytes == null) {
        unawaited(ensureMessagePreviewLoaded(message));
      }
    }
  }

  BotMessage _mergeMediaPresentation(BotMessage previous, BotMessage next) {
    final shouldKeepLocalPreview = previous.localPreviewBytes != null &&
        next.type == BotMessageType.image &&
        (next.thumbnailUrl?.trim().isEmpty ?? true) &&
        (next.mediaUrl?.trim().isEmpty ?? true);

    final shouldKeepLocalFile = previous.localFileBytes != null &&
        next.author == BotMessageAuthor.operator &&
        next.state == BotMessageState.failed;

    return next.copyWith(
      localPreviewBytes:
          shouldKeepLocalPreview ? previous.localPreviewBytes : null,
      localFileBytes: shouldKeepLocalFile ? previous.localFileBytes : null,
      clearLocalPreviewBytes: !shouldKeepLocalPreview,
      clearLocalFileBytes: !shouldKeepLocalFile,
    );
  }

  @override
  void dispose() {
    _backgroundRefreshTimer?.cancel();
    _realtimeReconnectTimer?.cancel();
    _recordingTicker?.cancel();
    unawaited(_recordingAmplitudeSubscription?.cancel());
    unawaited(_audioRecorder.dispose());
    unawaited(_realtimeSubscription?.cancel());
    messageComposerController.removeListener(_handleComposerChanged);
    messageComposerController.dispose();
    promptTitleController.dispose();
    promptDescriptionController.dispose();
    promptEditorController.dispose();
    super.dispose();
  }

  void _clearRecordingUiState() {
    _isRecordingAudio = false;
    _isPreparingAudio = false;
    _recordingDuration = Duration.zero;
    _recordingLevel = 0;
    _recordingFilePath = null;
  }

  Future<void> _deleteRecordingFile(String? path) async {
    if (path == null || path.isEmpty) {
      return;
    }

    try {
      final file = File(path);
      if (await file.exists()) {
        await file.parent.delete(recursive: true);
        return;
      }

      final directory = Directory(File(path).parent.path);
      if (await directory.exists()) {
        await directory.delete(recursive: true);
      }
    } catch (_) {
      // Ignore temp cleanup failures.
    }
  }
}

class _PickedMedia {
  const _PickedMedia({
    required this.bytes,
    required this.previewBytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final Uint8List? previewBytes;
  final String fileName;
  final String mimeType;
}

class _CompressedImage {
  const _CompressedImage({
    required this.bytes,
    required this.previewBytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final Uint8List previewBytes;
  final String fileName;
  final String mimeType;
}
