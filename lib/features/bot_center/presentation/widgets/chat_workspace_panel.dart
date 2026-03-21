import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_message.dart';
import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

final ValueNotifier<String?> _activeAudioMessageId = ValueNotifier<String?>(
  null,
);

class ChatWorkspacePanel extends StatelessWidget {
  const ChatWorkspacePanel({
    required this.controller,
    required this.isContextExpanded,
    required this.onToggleContext,
    super.key,
  });

  final BotCenterController controller;
  final bool isContextExpanded;
  final VoidCallback onToggleContext;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (!controller.hasConversationSelection && !controller.isInitialLoading) {
      return _EmptyConversation(theme: theme);
    }

    final conversation = controller.selectedConversation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ConversationHeader(
          controller: controller,
          conversation: conversation,
          isContextExpanded: isContextExpanded,
          onToggleContext: onToggleContext,
        ),
        const SizedBox(height: 6),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: theme.colorScheme.outlineVariant),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0D0F172A),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Colors.white,
                            Color(0xFFF8FBFF),
                            Color(0xFFF1F5F9),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 8 + 66 + 14),
                    child: _MessageViewport(controller: controller),
                  ),
                ),
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: _FloatingComposer(controller: controller),
                ),
                if (controller.hasConversationSelection)
                  Positioned(
                    right: 18,
                    bottom: 88,
                    child: _AiFloatingActionButton(controller: controller),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _EmptyConversation extends StatelessWidget {
  const _EmptyConversation({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.forum_outlined,
                size: 34, color: theme.colorScheme.primary),
            const SizedBox(height: 12),
            Text(
              'Selecciona un chat',
              style: theme.textTheme.titleMedium?.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF0F172A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Elige una conversación en la columna de la izquierda para ver el historial y responder.',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontSize: 13,
                color: const Color(0xFF475569),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationHeader extends StatelessWidget {
  const _ConversationHeader({
    required this.controller,
    required this.conversation,
    required this.isContextExpanded,
    required this.onToggleContext,
  });

  final BotCenterController controller;
  final BotConversation conversation;
  final bool isContextExpanded;
  final VoidCallback onToggleContext;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 12,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFFE2E8F0),
            child: Text(
              conversation.contactName.characters.first,
              style: theme.textTheme.labelLarge?.copyWith(
                color: const Color(0xFF0F172A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  conversation.contactName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Activo • ${conversation.phoneNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 11.5,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip:
                isContextExpanded ? 'Ocultar contexto' : 'Mostrar contexto',
            onPressed: onToggleContext,
            icon: Icon(
              isContextExpanded
                  ? Icons.keyboard_double_arrow_right_rounded
                  : Icons.dock_outlined,
            ),
          ),
          IconButton(
            tooltip: 'Buscar en conversación',
            onPressed: () {},
            icon: const Icon(Icons.search_rounded),
          ),
          PopupMenuButton<String>(
            tooltip: 'Opciones',
            onSelected: (value) async {
              if (value != 'delete_conversation') {
                return;
              }

              final confirmed = await showDialog<bool>(
                context: context,
                builder: (dialogContext) {
                  return AlertDialog(
                    title: const Text('Eliminar contacto'),
                    content: const Text(
                      'Esto borrarÃ¡ el chat de Bot Center y los datos asociados del contacto para regenerarlos limpios con el prÃ³ximo mensaje entrante.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(dialogContext).pop(false),
                        child: const Text('Cancelar'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.of(dialogContext).pop(true),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                        ),
                        child: const Text('Eliminar'),
                      ),
                    ],
                  );
                },
              );

              if (confirmed == true) {
                unawaited(controller.deleteSelectedConversation());
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem<String>(
                value: 'delete_conversation',
                child: Text('Eliminar contacto'),
              ),
            ],
            icon: const Icon(Icons.more_horiz_rounded),
          ),
        ],
      ),
    );
  }
}

class _MessageViewport extends StatefulWidget {
  const _MessageViewport({required this.controller});

  final BotCenterController controller;

  @override
  State<_MessageViewport> createState() => _MessageViewportState();
}

class _MessageViewportState extends State<_MessageViewport> {
  late final ScrollController _scrollController = ScrollController();
  var _lastRenderedMessageCount = 0;
  String _lastConversationId = '';
  String _lastMessageIdentity = '';
  bool _shouldStickToBottom = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScrollChange);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScrollChange);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    if (controller.isConversationLoading) {
      return const Center(
        child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 3)),
      );
    }

    if (controller.selectedMessages.isEmpty) {
      return Center(
        child: Text(
          'Aún no hay mensajes en esta conversación.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontSize: 13,
                color: const Color(0xFF475569),
              ),
          textAlign: TextAlign.center,
        ),
      );
    }

    _scheduleScrollToBottomIfNeeded(
      conversationId: controller.selectedConversationId,
      messages: controller.selectedMessages,
    );

    return Scrollbar(
      controller: _scrollController,
      child: ListView.separated(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(2, 0, 2, 6),
        itemCount: controller.selectedMessages.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final message = controller.selectedMessages[index];
          return _MessageBubble(controller: controller, message: message);
        },
      ),
    );
  }

  void _scheduleScrollToBottomIfNeeded({
    required String conversationId,
    required List<BotMessage> messages,
  }) {
    final nextMessageCount = messages.length;
    final lastMessageIdentity = messages.isEmpty
        ? ''
        : '${messages.last.id}:${messages.last.state.name}:${messages.last.timestamp.microsecondsSinceEpoch}';
    final conversationChanged = conversationId != _lastConversationId;
    final messageChanged = nextMessageCount != _lastRenderedMessageCount ||
        lastMessageIdentity != _lastMessageIdentity;

    if (!conversationChanged && !messageChanged) {
      return;
    }

    _lastConversationId = conversationId;
    _lastRenderedMessageCount = nextMessageCount;
    _lastMessageIdentity = lastMessageIdentity;
    final shouldAutoScroll = conversationChanged || _shouldStickToBottom;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) {
        return;
      }

      if (!shouldAutoScroll) {
        return;
      }

      final position = _scrollController.position.maxScrollExtent;
      if (conversationChanged) {
        _scrollController.jumpTo(position);
      } else {
        _scrollController.animateTo(
          position,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  void _handleScrollChange() {
    if (!_scrollController.hasClients) {
      return;
    }

    final distanceToBottom =
        _scrollController.position.maxScrollExtent - _scrollController.offset;
    _shouldStickToBottom = distanceToBottom <= 56;
  }
}

class _FloatingComposer extends StatelessWidget {
  const _FloatingComposer({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isRecording =
        controller.isRecordingAudio || controller.isPreparingAudio;
    final canRecord = controller.canStartAudioRecording;
    final canSend = controller.hasConversationSelection &&
        controller.hasDraftMessage &&
        !controller.isSendingMessage &&
        !controller.isProcessingWithAi &&
        !controller.isPreparingAudio;

    void sendMessage() {
      if (!canSend) {
        return;
      }
      unawaited(controller.sendDraftMessage());
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x160F172A),
            blurRadius: 14,
            offset: Offset(0, 6),
          ),
        ],
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Adjuntar',
            onPressed: !isRecording &&
                    controller.hasConversationSelection &&
                    !controller.isSendingMessage &&
                    !controller.isProcessingWithAi
                ? () async {
                    final selection =
                        await showModalBottomSheet<BotMessageType>(
                      context: context,
                      builder: (sheetContext) {
                        return SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ListTile(
                                leading: const Icon(Icons.image_outlined),
                                title: const Text('Enviar imagen'),
                                onTap: () => Navigator.of(sheetContext)
                                    .pop(BotMessageType.image),
                              ),
                              ListTile(
                                leading: const Icon(Icons.videocam_outlined),
                                title: const Text('Enviar video'),
                                onTap: () => Navigator.of(sheetContext)
                                    .pop(BotMessageType.video),
                              ),
                            ],
                          ),
                        );
                      },
                    );

                    if (selection != null) {
                      unawaited(controller.pickAndSendMedia(selection));
                    }
                  }
                : null,
            icon: const Icon(Icons.add_rounded),
          ),
          Expanded(
            child: isRecording
                ? _RecordingStatusStrip(controller: controller)
                : CallbackShortcuts(
                    bindings: <ShortcutActivator, VoidCallback>{
                      const SingleActivator(LogicalKeyboardKey.enter):
                          sendMessage,
                      const SingleActivator(LogicalKeyboardKey.numpadEnter):
                          sendMessage,
                    },
                    child: TextField(
                      controller: controller.messageComposerController,
                      decoration: InputDecoration(
                        hintText: 'Escribir mensaje...',
                        hintStyle: theme.textTheme.bodyMedium?.copyWith(
                          fontSize: 13,
                          color: const Color(0xFF94A3B8),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => sendMessage(),
                      minLines: 1,
                      maxLines: 3,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontSize: 13.5,
                        color: const Color(0xFF0F172A),
                        height: 1.35,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 6),
          if (controller.hasDraftMessage || isRecording)
            SizedBox(
              height: 40,
              child: FilledButton(
                onPressed: canSend ? sendMessage : null,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  controller.isSendingMessage
                      ? 'Enviando...'
                      : controller.isPreparingAudio
                          ? 'Procesando...'
                          : 'Enviar',
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            )
          else
            Tooltip(
              message: 'Mantén presionado para grabar una nota de voz',
              child: GestureDetector(
                onLongPressStart: canRecord
                    ? (_) => unawaited(controller.startAudioRecording())
                    : null,
                onLongPressEnd: controller.isRecordingAudio
                    ? (_) => unawaited(controller.finishAudioRecording())
                    : null,
                onLongPressCancel: controller.isRecordingAudio
                    ? () => unawaited(
                          controller.finishAudioRecording(cancel: true),
                        )
                    : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: controller.isRecordingAudio
                        ? const Color(0xFFDC2626)
                        : canRecord
                            ? const Color(0xFF0F172A)
                            : const Color(0xFF94A3B8),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: controller.isRecordingAudio
                        ? const [
                            BoxShadow(
                              color: Color(0x33DC2626),
                              blurRadius: 18,
                              offset: Offset(0, 8),
                            ),
                          ]
                        : const [],
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    controller.isPreparingAudio
                        ? Icons.hourglass_top_rounded
                        : Icons.mic_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RecordingStatusStrip extends StatelessWidget {
  const _RecordingStatusStrip({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final duration = _formatAudioDuration(controller.recordingDuration);
    final level = controller.recordingLevel.clamp(0.12, 1.0);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: 12 + (level * 8),
            height: 12 + (level * 8),
            decoration: const BoxDecoration(
              color: Color(0xFFDC2626),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  controller.isPreparingAudio
                      ? 'Procesando nota de voz...'
                      : 'Grabando... suelta para enviar',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 12.8,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                _AudioWaveform(
                  messageId: 'recording-preview',
                  progress: level,
                  activeColor: const Color(0xFFDC2626),
                  inactiveColor: const Color(0xFFFCA5A5),
                  height: 20,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            duration,
            style: theme.textTheme.labelLarge?.copyWith(
              color: const Color(0xFFDC2626),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.controller, required this.message});

  final BotCenterController controller;
  final BotMessage message;

  @override
  Widget build(BuildContext context) {
    final isIncoming = message.isIncoming;
    final isSystem = message.author == BotMessageAuthor.system;
    final isOutgoing = !isIncoming && !isSystem;
    final bubbleColor = isOutgoing
        ? const Color(0xFF2563EB)
        : isSystem
            ? const Color(0xFFE2E8F0)
            : Colors.white;
    final textColor = isOutgoing ? Colors.white : const Color(0xFF0F172A);
    final metaColor = isOutgoing
        ? Colors.white.withValues(alpha: 0.82)
        : const Color(0xFF64748B);
    final alignment = isOutgoing ? Alignment.centerRight : Alignment.centerLeft;
    final timeLabel = formatConversationTimestamp(message.timestamp);
    final displayText = message.caption?.trim().isNotEmpty == true
        ? message.caption!
        : message.body;
    final hasDisplayText = !message.isAudio && displayText.trim().isNotEmpty;

    return LayoutBuilder(
      builder: (context, constraints) {
        final mediaHeavy = message.hasVisualMedia || message.isAudio;
        final maxWidthFactor = constraints.maxWidth >= 1200
            ? (mediaHeavy ? 0.88 : 0.78)
            : constraints.maxWidth >= 840
                ? (mediaHeavy ? 0.84 : 0.76)
                : (mediaHeavy ? 0.92 : 0.84);

        return Align(
          alignment: alignment,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: constraints.maxWidth * maxWidthFactor,
            ),
            child: Column(
              crossAxisAlignment: isOutgoing
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    _senderLabel(message.author),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 10.5,
                          color: metaColor,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                const SizedBox(height: 5),
                Container(
                  padding: EdgeInsets.all(
                    message.hasVisualMedia
                        ? 8
                        : message.isAudio
                            ? 10
                            : 12,
                  ),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: BorderRadius.circular(18),
                    border: isOutgoing
                        ? null
                        : Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withValues(
                          alpha: isOutgoing ? 0.08 : 0.05,
                        ),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (message.isAudio)
                        _AudioMessageCard(
                          controller: controller,
                          message: message,
                          isOutgoing: isOutgoing,
                        )
                      else if (message.hasVisualMedia)
                        _MessageMedia(
                          controller: controller,
                          message: message,
                        ),
                      if (hasDisplayText) ...[
                        if (message.hasVisualMedia || message.isAudio)
                          const SizedBox(height: 10),
                        Text(
                          displayText,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontSize: 13,
                                    color: textColor,
                                    height: 1.35,
                                  ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (message.canRetry) ...[
                            IconButton(
                              tooltip: 'Reintentar envío',
                              onPressed: () => unawaited(
                                controller.retryFailedMessage(message),
                              ),
                              icon: Icon(
                                Icons.refresh_rounded,
                                size: 18,
                                color: isOutgoing
                                    ? Colors.white
                                    : const Color(0xFF2563EB),
                              ),
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints.tightFor(
                                width: 24,
                                height: 24,
                              ),
                            ),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            timeLabel,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      fontSize: 10,
                                      color: metaColor,
                                      fontWeight: FontWeight.w600,
                                    ),
                          ),
                          if (message.author == BotMessageAuthor.operator) ...[
                            const SizedBox(width: 6),
                            _MessageStateIndicator(state: message.state),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MessageMedia extends StatefulWidget {
  const _MessageMedia({required this.controller, required this.message});

  final BotCenterController controller;
  final BotMessage message;

  @override
  State<_MessageMedia> createState() => _MessageMediaState();
}

class _MessageMediaState extends State<_MessageMedia> {
  @override
  void initState() {
    super.initState();
    _schedulePreviewLoad();
  }

  @override
  void didUpdateWidget(covariant _MessageMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message.id != widget.message.id ||
        oldWidget.message.localPreviewBytes !=
            widget.message.localPreviewBytes ||
        oldWidget.message.thumbnailUrl != widget.message.thumbnailUrl ||
        oldWidget.message.mediaUrl != widget.message.mediaUrl) {
      _schedulePreviewLoad();
    }
  }

  void _schedulePreviewLoad() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(widget.controller.ensureMessagePreviewLoaded(widget.message));
    });
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final previewBytes = _resolveInlinePreviewBytes(message);
    final previewUrl = _resolvePreviewUrl(message);
    final hasVisual = previewBytes != null || previewUrl != null;
    final mediaLabel = message.fileName?.trim().isNotEmpty == true
        ? message.fileName!
        : (message.isImage ? 'Imagen' : 'Video');

    return GestureDetector(
      onTap: () async {
        if (message.isImage && (previewBytes != null || previewUrl != null)) {
          await widget.controller.ensureMessagePlayableLoaded(message);
          final resolved = widget.controller
                  .findMessageById(message.conversationId, message.id) ??
              message;
          if (!context.mounted) {
            return;
          }
          showDialog<void>(
            context: context,
            builder: (_) => _ImagePreviewDialog(message: resolved),
          );
        } else if (message.isVideo &&
            _resolvePlayableVideoUrl(message) != null) {
          await widget.controller.ensureMessagePreviewLoaded(message);
          await widget.controller.ensureMessagePlayableLoaded(message);
          final resolved = widget.controller
                  .findMessageById(message.conversationId, message.id) ??
              message;
          if (!context.mounted) {
            return;
          }
          showDialog<void>(
            context: context,
            builder: (_) => _VideoPreviewDialog(message: resolved),
          );
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final mediaWidth = math.min(constraints.maxWidth, 300.0);

            return ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: 300,
                maxHeight: 250,
              ),
              child: SizedBox(
                width: mediaWidth,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: double.infinity,
                      constraints: const BoxConstraints(
                        maxWidth: 300,
                        maxHeight: 250,
                        minHeight: 190,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF111827),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.10),
                        ),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          DecoratedBox(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Color(0xFF1F2937),
                                  Color(0xFF111827),
                                ],
                              ),
                            ),
                            child: _buildMediaVisual(
                              message: message,
                              previewBytes: previewBytes,
                              previewUrl: previewUrl,
                              hasVisual: hasVisual,
                            ),
                          ),
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withValues(alpha: 0.05),
                                    Colors.black.withValues(alpha: 0.34),
                                  ],
                                  stops: const [0.50, 0.74, 1],
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 12,
                            right: 12,
                            bottom: 12,
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    mediaLabel,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelLarge
                                        ?.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(
                                      color:
                                          Colors.white.withValues(alpha: 0.18),
                                    ),
                                  ),
                                  child: Text(
                                    message.isImage ? 'Foto' : 'Video',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (message.isVideo)
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.58),
                          shape: BoxShape.circle,
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x4D020617),
                              blurRadius: 18,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 34,
                        ),
                      ),
                    if (message.state == BotMessageState.queued)
                      Container(
                        color: Colors.black.withValues(alpha: 0.18),
                        alignment: Alignment.center,
                        child: const SizedBox(
                          width: 26,
                          height: 26,
                          child: CircularProgressIndicator(strokeWidth: 2.8),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildMediaVisual({
    required BotMessage message,
    required Uint8List? previewBytes,
    required String? previewUrl,
    required bool hasVisual,
  }) {
    if (previewBytes != null) {
      return Image.memory(
        previewBytes,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => _mediaFailurePlaceholder(message),
      );
    }

    if (previewUrl != null) {
      return CachedNetworkImage(
        imageUrl: previewUrl,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (_, __) => const _MediaLoadingPlaceholder(),
        errorWidget: (_, __, ___) => _mediaFailurePlaceholder(message),
      );
    }

    if (message.state == BotMessageState.queued) {
      return const _MediaLoadingPlaceholder();
    }

    return _MediaFallbackState(
      icon: hasVisual
          ? (message.isImage
              ? Icons.image_not_supported_outlined
              : Icons.videocam_off_outlined)
          : (message.isImage ? Icons.image_outlined : Icons.videocam_outlined),
      label: 'No se pudo cargar',
    );
  }

  Widget _mediaFailurePlaceholder(BotMessage message) {
    return _MediaFallbackState(
      icon: message.isImage
          ? Icons.broken_image_outlined
          : Icons.videocam_off_outlined,
      label: 'No se pudo cargar',
    );
  }
}

class _AudioMessageCard extends StatefulWidget {
  const _AudioMessageCard({
    required this.controller,
    required this.message,
    required this.isOutgoing,
  });

  final BotCenterController controller;
  final BotMessage message;
  final bool isOutgoing;

  @override
  State<_AudioMessageCard> createState() => _AudioMessageCardState();
}

class _AudioMessageCardState extends State<_AudioMessageCard> {
  late final Player _player;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration>? _durationSubscription;
  StreamSubscription<bool>? _playingSubscription;
  StreamSubscription<bool>? _completedSubscription;
  File? _tempFile;
  String? _openedSourceKey;
  String? _errorMessage;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _player = Player();
    _positionSubscription = _player.stream.position.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() => _position = value);
    });
    _durationSubscription = _player.stream.duration.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() => _duration = value);
    });
    _playingSubscription = _player.stream.playing.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() => _isPlaying = value);
    });
    _completedSubscription = _player.stream.completed.listen((value) async {
      if (!value) {
        return;
      }

      await _player.pause();
      await _player.seek(Duration.zero);
      if (_activeAudioMessageId.value == widget.message.id) {
        _activeAudioMessageId.value = null;
      }
    });
    _activeAudioMessageId.addListener(_handleActiveAudioChanged);
  }

  @override
  void didUpdateWidget(covariant _AudioMessageCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message.id != widget.message.id ||
        oldWidget.message.mediaUrl != widget.message.mediaUrl ||
        oldWidget.message.localFileBytes != widget.message.localFileBytes) {
      _openedSourceKey = null;
      _errorMessage = null;
      _position = Duration.zero;
      _duration = Duration.zero;
    }
  }

  @override
  void dispose() {
    _activeAudioMessageId.removeListener(_handleActiveAudioChanged);
    unawaited(_positionSubscription?.cancel());
    unawaited(_durationSubscription?.cancel());
    unawaited(_playingSubscription?.cancel());
    unawaited(_completedSubscription?.cancel());
    _player.dispose();
    final file = _tempFile;
    if (file != null) {
      unawaited(file.parent.delete(recursive: true));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final totalDuration = _resolvedDuration(message);
    final progress = totalDuration.inMilliseconds <= 0
        ? 0.0
        : (_position.inMilliseconds / totalDuration.inMilliseconds)
            .clamp(0.0, 1.0);
    final accent = widget.isOutgoing ? Colors.white : const Color(0xFF0F172A);
    final secondary = widget.isOutgoing
        ? Colors.white.withValues(alpha: 0.72)
        : const Color(0xFF64748B);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
        decoration: BoxDecoration(
          color: widget.isOutgoing
              ? Colors.white.withValues(alpha: 0.08)
              : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: widget.isOutgoing
                ? Colors.white.withValues(alpha: 0.12)
                : const Color(0xFFE2E8F0),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                InkWell(
                  onTap: _togglePlayback,
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: widget.isOutgoing
                          ? Colors.white.withValues(alpha: 0.14)
                          : const Color(0xFFDBEAFE),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      _isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      color: widget.isOutgoing
                          ? Colors.white
                          : const Color(0xFF2563EB),
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AudioWaveform(
                        messageId: message.id,
                        progress: progress,
                        activeColor: accent,
                        inactiveColor: secondary.withValues(alpha: 0.28),
                        onSeekFraction: totalDuration.inMilliseconds > 0
                            ? (fraction) =>
                                _seekToFraction(fraction, totalDuration)
                            : null,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            _formatAudioDuration(_position),
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: secondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                          ),
                          const Spacer(),
                          Text(
                            _formatAudioDuration(totalDuration),
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: secondary,
                                      fontWeight: FontWeight.w700,
                                    ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    size: 14,
                    color: widget.isOutgoing
                        ? const Color(0xFFFECACA)
                        : const Color(0xFFDC2626),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: widget.isOutgoing
                                ? const Color(0xFFFECACA)
                                : const Color(0xFFB91C1C),
                            fontSize: 11.5,
                          ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _togglePlayback() async {
    if (_isPlaying) {
      await _player.pause();
      if (_activeAudioMessageId.value == widget.message.id) {
        _activeAudioMessageId.value = null;
      }
      return;
    }

    _activeAudioMessageId.value = widget.message.id;
    final ready = await _ensureSourceReady();
    if (!ready) {
      return;
    }

    await _player.play();
    if (widget.message.localFileBytes == null) {
      unawaited(widget.controller.ensureMessagePlayableLoaded(widget.message));
    }
  }

  Future<bool> _ensureSourceReady() async {
    final localBytes = widget.message.localFileBytes;
    if (localBytes != null && localBytes.isNotEmpty) {
      final nextKey = 'local:${widget.message.id}:${localBytes.length}';
      if (_openedSourceKey == nextKey) {
        return true;
      }

      try {
        final directory =
            await Directory.systemTemp.createTemp('bot-center-audio-');
        final extension =
            _fileExtension(widget.message.fileName ?? 'audio.mp3');
        final file = File(
          '${directory.path}${Platform.pathSeparator}audio.$extension',
        );
        await file.writeAsBytes(localBytes, flush: true);

        final previousFile = _tempFile;
        _tempFile = file;
        if (previousFile != null) {
          unawaited(previousFile.parent.delete(recursive: true));
        }

        await _player.open(Media(file.path), play: false);
        _openedSourceKey = nextKey;
        if (mounted) {
          setState(() => _errorMessage = null);
        }
        return true;
      } catch (_) {
        if (mounted) {
          setState(() {
            _errorMessage = 'No se pudo reproducir el audio local.';
          });
        }
        return false;
      }
    }

    final remoteUrl = _resolvePlayableAudioUrl(widget.message);
    if (remoteUrl == null) {
      if (mounted) {
        setState(() {
          _errorMessage = 'El audio no está disponible todavía.';
        });
      }
      return false;
    }

    final nextKey = 'remote:$remoteUrl';
    if (_openedSourceKey == nextKey) {
      return true;
    }

    try {
      await _player.open(Media(remoteUrl), play: false);
      _openedSourceKey = nextKey;
      if (mounted) {
        setState(() => _errorMessage = null);
      }
      return true;
    } catch (_) {
      if (mounted) {
        setState(() {
          _errorMessage = 'No se pudo cargar el audio.';
        });
      }
      return false;
    }
  }

  void _seekToFraction(double fraction, Duration totalDuration) {
    final clamped = fraction.clamp(0.0, 1.0);
    final nextPosition = Duration(
      milliseconds: (totalDuration.inMilliseconds * clamped).round(),
    );
    unawaited(_player.seek(nextPosition));
  }

  Duration _resolvedDuration(BotMessage message) {
    if (_duration.inMilliseconds > 0) {
      return _duration;
    }

    return Duration(seconds: message.durationSeconds ?? 0);
  }

  void _handleActiveAudioChanged() {
    if (_activeAudioMessageId.value == widget.message.id || !_isPlaying) {
      return;
    }

    unawaited(_player.pause());
  }
}

class _AudioWaveform extends StatelessWidget {
  const _AudioWaveform({
    required this.messageId,
    required this.progress,
    required this.activeColor,
    required this.inactiveColor,
    this.height = 26,
    this.onSeekFraction,
  });

  final String messageId;
  final double progress;
  final Color activeColor;
  final Color inactiveColor;
  final double height;
  final ValueChanged<double>? onSeekFraction;

  @override
  Widget build(BuildContext context) {
    final normalizedProgress = progress.clamp(0.0, 1.0);

    return LayoutBuilder(
      builder: (context, constraints) {
        final bars = List<double>.generate(28, (index) {
          final seed =
              messageId.codeUnits.fold<int>(17, (sum, unit) => sum + unit);
          final value = ((seed + (index * 19)) % 100) / 100;
          return 0.28 + (value * 0.72);
        });

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: onSeekFraction == null
              ? null
              : (details) {
                  final width =
                      constraints.maxWidth <= 0 ? 1.0 : constraints.maxWidth;
                  onSeekFraction!(details.localPosition.dx / width);
                },
          child: SizedBox(
            height: height,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: List<Widget>.generate(bars.length, (index) {
                final barProgress = (index + 1) / bars.length;
                final color = barProgress <= normalizedProgress
                    ? activeColor
                    : inactiveColor;
                return Expanded(
                  child: Align(
                    alignment: Alignment.center,
                    child: Container(
                      width: 3.2,
                      height: height * bars[index],
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        );
      },
    );
  }
}

class _AiFloatingActionButton extends StatelessWidget {
  const _AiFloatingActionButton({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      heroTag: 'bot-center-ai-fab',
      onPressed: () => _showAiActionSheet(context),
      backgroundColor: const Color(0xFF0F172A),
      foregroundColor: Colors.white,
      elevation: 8,
      highlightElevation: 10,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      child: controller.isProcessingWithAi
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            )
          : const Icon(Icons.auto_awesome_rounded),
    );
  }

  Future<void> _showAiActionSheet(BuildContext context) async {
    final theme = Theme.of(context);
    final canProcessWithAi = controller.hasConversationSelection &&
        controller.hasDraftMessage &&
        !controller.isProcessingWithAi &&
        !controller.isSendingMessage;
    final latestLog = controller.latestVisibleLog;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x290F172A),
                    blurRadius: 30,
                    offset: Offset(0, 16),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 42,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.auto_awesome_rounded,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Herramientas IA',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                controller.isProcessingWithAi
                                    ? 'La IA está trabajando sobre el borrador actual.'
                                    : 'Accede a las acciones inteligentes del chat desde aquí.',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFF64748B),
                                  fontSize: 12.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(18),
                        border:
                            Border.all(color: theme.colorScheme.outlineVariant),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Estado actual',
                            style: theme.textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            latestLog == null
                                ? 'Aún no hay una ejecución IA reciente para este chat.'
                                : '${latestLog.eventType} · ${latestLog.summary}',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontSize: 13,
                              color: const Color(0xFF475569),
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: canProcessWithAi
                            ? () {
                                Navigator.of(sheetContext).pop();
                                unawaited(controller.processDraftWithAi());
                              }
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        icon: const Icon(Icons.bolt_rounded),
                        label: Text(
                          controller.isProcessingWithAi
                              ? 'IA en ejecución'
                              : 'Procesar borrador con IA',
                        ),
                      ),
                    ),
                    if (!controller.hasDraftMessage) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Escribe un borrador en el compositor para habilitar la acción de IA.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF64748B),
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

Uint8List? _resolveInlinePreviewBytes(BotMessage message) {
  final localBytes = message.localPreviewBytes;
  if (_isValidImageBytes(localBytes)) {
    return localBytes;
  }

  final thumbnailBytes = _tryDecodeImageSource(message.thumbnailUrl);
  if (thumbnailBytes != null) {
    return thumbnailBytes;
  }

  if (message.isImage) {
    return _tryDecodeImageSource(message.mediaUrl);
  }

  return null;
}

String? _resolvePreviewUrl(BotMessage message) {
  final thumbnailUrl = _asHttpUrl(message.thumbnailUrl);
  if (thumbnailUrl != null) {
    return thumbnailUrl;
  }

  if (message.isImage) {
    return _asHttpUrl(message.mediaUrl);
  }

  return null;
}

String? _resolvePlayableVideoUrl(BotMessage message) {
  if (!message.isVideo) {
    return null;
  }

  return _asHttpUrl(message.mediaUrl);
}

String? _resolvePlayableAudioUrl(BotMessage message) {
  if (!message.isAudio) {
    return null;
  }

  return _asHttpUrl(message.mediaUrl);
}

String? _asHttpUrl(String? candidate) {
  final trimmed = candidate?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  final uri = Uri.tryParse(trimmed);
  if (uri == null) {
    return null;
  }

  if (uri.scheme == 'http' || uri.scheme == 'https') {
    return trimmed;
  }

  return null;
}

Uint8List? _tryDecodeImageSource(String? source) {
  final trimmed = source?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return null;
  }

  var payload = trimmed;
  if (trimmed.startsWith('data:')) {
    final commaIndex = trimmed.indexOf(',');
    if (commaIndex < 0) {
      return null;
    }

    final metadata = trimmed.substring(0, commaIndex).toLowerCase();
    if (!metadata.startsWith('data:image/') || !metadata.contains(';base64')) {
      return null;
    }
    payload = trimmed.substring(commaIndex + 1);
  }

  final normalized = payload.replaceAll(RegExp(r'\s+'), '');
  if (normalized.isEmpty || !_looksLikeBase64(normalized)) {
    return null;
  }

  try {
    final bytes = base64Decode(normalized);
    return _isValidImageBytes(bytes) ? bytes : null;
  } catch (_) {
    return null;
  }
}

bool _looksLikeBase64(String value) {
  return RegExp(r'^[A-Za-z0-9+/=]+$').hasMatch(value);
}

bool _isValidImageBytes(Uint8List? bytes) {
  if (bytes == null || bytes.isEmpty) {
    return false;
  }

  return img.decodeImage(bytes) != null;
}

class _MessageStateIndicator extends StatelessWidget {
  const _MessageStateIndicator({required this.state});

  final BotMessageState state;

  @override
  Widget build(BuildContext context) {
    const mutedCheckColor = Color(0xFFE2E8F0);
    final icon = switch (state) {
      BotMessageState.queued => Icons.schedule_rounded,
      BotMessageState.sent => Icons.done_rounded,
      BotMessageState.delivered => Icons.done_all_rounded,
      BotMessageState.read => Icons.done_all_rounded,
      BotMessageState.failed => Icons.error_outline_rounded,
    };
    final color = switch (state) {
      BotMessageState.read => const Color(0xFF34B7F1),
      BotMessageState.queued => mutedCheckColor,
      BotMessageState.sent => mutedCheckColor,
      BotMessageState.delivered => mutedCheckColor,
      BotMessageState.failed => const Color(0xFFFCA5A5),
    };

    return Icon(icon, size: 16, color: color);
  }
}

class _ImagePreviewDialog extends StatelessWidget {
  const _ImagePreviewDialog({required this.message});

  final BotMessage message;

  @override
  Widget build(BuildContext context) {
    final previewBytes = _resolveInlinePreviewBytes(message);
    final previewUrl = _resolvePreviewUrl(message);

    return Dialog.fullscreen(
      backgroundColor: const Color(0xFF020617),
      child: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              child: previewBytes != null
                  ? Image.memory(
                      previewBytes,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.broken_image_outlined,
                        color: Colors.white70,
                        size: 56,
                      ),
                    )
                  : (previewUrl != null
                      ? CachedNetworkImage(
                          imageUrl: previewUrl,
                          fit: BoxFit.contain,
                          placeholder: (_, __) =>
                              const _MediaLoadingPlaceholder(),
                          errorWidget: (_, __, ___) => const Icon(
                            Icons.broken_image_outlined,
                            color: Colors.white70,
                            size: 56,
                          ),
                        )
                      : const Icon(
                          Icons.broken_image_outlined,
                          color: Colors.white70,
                          size: 56,
                        )),
            ),
          ),
          Positioned(
            top: 18,
            right: 18,
            child: IconButton.filledTonal(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaLoadingPlaceholder extends StatelessWidget {
  const _MediaLoadingPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0F172A),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(strokeWidth: 2.6),
      ),
    );
  }
}

class _MediaFallbackState extends StatelessWidget {
  const _MediaFallbackState({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF4B5563),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: Colors.white70,
            size: 40,
          ),
          const SizedBox(height: 10),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white70,
                  fontSize: 12,
                  height: 1.35,
                ),
          ),
        ],
      ),
    );
  }
}

class _VideoPreviewDialog extends StatefulWidget {
  const _VideoPreviewDialog({required this.message});

  final BotMessage message;

  @override
  State<_VideoPreviewDialog> createState() => _VideoPreviewDialogState();
}

class _VideoPreviewDialogState extends State<_VideoPreviewDialog> {
  late final Player _player;
  late final VideoController _videoController;
  File? _tempFile;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _player = Player();
    _videoController = VideoController(_player);
    unawaited(_openVideo());
  }

  Future<void> _openVideo() async {
    try {
      if (widget.message.localFileBytes != null &&
          widget.message.localFileBytes!.isNotEmpty) {
        final directory =
            await Directory.systemTemp.createTemp('bot-center-video-');
        final extension =
            _fileExtension(widget.message.fileName ?? 'video.mp4');
        final file = File('${directory.path}\\video.$extension');
        await file.writeAsBytes(widget.message.localFileBytes!, flush: true);
        _tempFile = file;
        await _player.open(Media(file.path));
        return;
      }

      final remoteUrl = _resolvePlayableVideoUrl(widget.message);
      if (remoteUrl != null) {
        await _player.open(Media(remoteUrl));
        return;
      }
    } catch (_) {
      // handled below
    }

    if (mounted) {
      setState(() {
        _errorMessage = 'No se pudo cargar el video';
      });
    }
  }

  @override
  void dispose() {
    _player.dispose();
    final file = _tempFile;
    if (file != null) {
      unawaited(file.parent.delete(recursive: true));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      backgroundColor: const Color(0xFF020617),
      child: Stack(
        children: [
          Center(
            child: _errorMessage != null
                ? Container(
                    width: 360,
                    constraints: const BoxConstraints(maxWidth: 360),
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1F2937),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.videocam_off_outlined,
                          color: Colors.white70,
                          size: 54,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  )
                : AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Video(controller: _videoController),
                  ),
          ),
          Positioned(
            top: 18,
            right: 18,
            child: IconButton.filledTonal(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
        ],
      ),
    );
  }
}

String _fileExtension(String fileName) {
  final parts = fileName.split('.');
  if (parts.length < 2) {
    return 'mp4';
  }

  final ext = parts.last.trim().toLowerCase();
  return ext.isEmpty ? 'mp4' : ext;
}

String _formatAudioDuration(Duration duration) {
  final totalSeconds = duration.inSeconds;
  final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
  final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

String _senderLabel(BotMessageAuthor author) {
  switch (author) {
    case BotMessageAuthor.contact:
      return 'Contacto';
    case BotMessageAuthor.bot:
      return 'Bot';
    case BotMessageAuthor.operator:
      return 'Operador';
    case BotMessageAuthor.system:
      return 'Sistema';
  }
}
