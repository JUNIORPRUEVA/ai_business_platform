import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:just_audio/just_audio.dart' as just_audio;
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_thumbnail/video_thumbnail.dart' as video_thumbnail;

import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_message.dart';
import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

final ValueNotifier<String?> _activeAudioMessageId = ValueNotifier<String?>(
  null,
);

class ChatWorkspacePanel extends StatefulWidget {
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
  State<ChatWorkspacePanel> createState() => _ChatWorkspacePanelState();
}

class _ChatWorkspacePanelState extends State<ChatWorkspacePanel> {
  late final ScrollController _messageScrollController = ScrollController();
  bool _isNearBottom = true;

  @override
  void dispose() {
    _messageScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final theme = Theme.of(context);

    if (!controller.hasConversationSelection && !controller.isInitialLoading) {
      return _EmptyConversation(theme: theme);
    }

    final conversation = controller.selectedConversation;
    final showScrollToBottomButton =
        controller.selectedMessages.isNotEmpty && !_isNearBottom;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ConversationHeader(
          controller: controller,
          conversation: conversation,
          isContextExpanded: widget.isContextExpanded,
          onToggleContext: widget.onToggleContext,
        ),
        const SizedBox(height: 6),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFEFEAE2),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFD5DCD9)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0B0F172A),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: IgnorePointer(
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Color(0xFFF5F0E8),
                                Color(0xFFEFE8DE),
                                Color(0xFFEAE3D9),
                              ],
                            ),
                          ),
                        ),
                        _ChatBackgroundPattern(),
                      ],
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 8 + 66 + 14),
                    child: _MessageViewport(
                      controller: controller,
                      scrollController: _messageScrollController,
                      onNearBottomChanged: _handleNearBottomChanged,
                    ),
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
                    bottom: 146,
                    child: _ScrollToBottomButton(
                      isVisible: showScrollToBottomButton,
                      onPressed: _scrollToBottom,
                    ),
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

  void _handleNearBottomChanged(bool isNearBottom) {
    if (_isNearBottom == isNearBottom || !mounted) {
      return;
    }

    setState(() {
      _isNearBottom = isNearBottom;
    });
  }

  void _scrollToBottom() {
    if (!_messageScrollController.hasClients) {
      return;
    }

    unawaited(
      _messageScrollController.animateTo(
        _messageScrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      ),
    );
  }
}

class _ScrollToBottomButton extends StatelessWidget {
  const _ScrollToBottomButton({
    required this.isVisible,
    required this.onPressed,
  });

  final bool isVisible;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: !isVisible,
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        offset: isVisible ? Offset.zero : const Offset(0, 0.35),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 180),
          opacity: isVisible ? 1 : 0,
          child: Material(
            color: Colors.transparent,
            elevation: 0,
            shape: const CircleBorder(),
            child: InkWell(
              onTap: onPressed,
              customBorder: const CircleBorder(),
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFD7DCE1)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x140F172A),
                      blurRadius: 10,
                      offset: Offset(0, 5),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.arrow_downward_rounded,
                  color: Color(0xFF00A884),
                  size: 22,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatBackgroundPattern extends StatelessWidget {
  const _ChatBackgroundPattern();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _ChatBackgroundPatternPainter(),
    );
  }
}

class _ChatBackgroundPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final loopPaint = Paint()
      ..color = const Color(0xFFD6CFC2).withValues(alpha: 0.38)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    final dotPaint = Paint()
      ..color = const Color(0xFFC8BFB0).withValues(alpha: 0.26)
      ..style = PaintingStyle.fill;
    const cellSize = 66.0;

    for (var row = -1; row <= (size.height / cellSize).ceil(); row++) {
      final y = row * cellSize;
      final xOffset = row.isEven ? 0.0 : cellSize / 2;

      for (var column = -1;
          column <= (size.width / cellSize).ceil();
          column++) {
        final x = (column * cellSize) + xOffset;
        final bubbleRect = RRect.fromRectAndRadius(
          Rect.fromLTWH(x + 16, y + 18, 18, 11),
          const Radius.circular(6),
        );
        final tailPath = Path()
          ..moveTo(x + 22, y + 29)
          ..lineTo(x + 18, y + 34)
          ..lineTo(x + 26, y + 30)
          ..close();

        canvas.drawRRect(bubbleRect, loopPaint);
        canvas.drawPath(tailPath, loopPaint);
        canvas.drawCircle(Offset(x + 44, y + 24), 2.1, dotPaint);
        canvas.drawCircle(Offset(x + 51, y + 31), 1.5, dotPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
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
    final autoReplyEnabled = conversation.autoReplyEnabled;
    final contactDisplayName =
        _resolveSelectedContactDisplayName(controller, conversation);
    final contactPhoneNumber = _resolveSelectedContactPhoneNumber(controller);
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F2F5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE3E7EA)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Stack(
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: const Color(0xFFDDE6EA),
                foregroundImage: _normalizedChatAvatarProvider(
                  conversation.profilePictureUrl,
                ),
                child: Text(
                  contactDisplayName.characters.first,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: const Color(0xFF111B21),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: const Color(0xFF25D366),
                    shape: BoxShape.circle,
                    border:
                        Border.all(color: const Color(0xFFF0F2F5), width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contactDisplayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111B21),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  contactPhoneNumber ?? 'Teléfono no disponible',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 11.5,
                    color: const Color(0xFF667781),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: autoReplyEnabled
                  ? const Color(0xFFDCFCE7)
                  : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: autoReplyEnabled
                    ? const Color(0xFF86EFAC)
                    : const Color(0xFFE2E8F0),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  autoReplyEnabled
                      ? Icons.smart_toy_rounded
                      : Icons.pause_circle_outline_rounded,
                  size: 16,
                  color: autoReplyEnabled
                      ? const Color(0xFF166534)
                      : const Color(0xFF64748B),
                ),
                const SizedBox(width: 6),
                Text(
                  'Modo agente',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: autoReplyEnabled
                        ? const Color(0xFF166534)
                        : const Color(0xFF475569),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  height: 24,
                  child: Switch.adaptive(
                    value: autoReplyEnabled,
                    onChanged: controller.isUpdatingAutoReply
                        ? null
                        : (value) => unawaited(
                              controller.setConversationAutoReplyEnabled(value),
                            ),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _HeaderIconButton(
            tooltip: 'Copiar nombre y teléfono',
            onPressed: () => unawaited(
              _copyContactSummary(
                context,
                contactName: contactDisplayName,
                contactPhoneNumber: contactPhoneNumber,
              ),
            ),
            icon: const Icon(Icons.content_copy_rounded),
          ),
          _HeaderIconButton(
            tooltip:
                isContextExpanded ? 'Ocultar contexto' : 'Mostrar contexto',
            onPressed: onToggleContext,
            icon: Icon(
              isContextExpanded
                  ? Icons.keyboard_double_arrow_right_rounded
                  : Icons.dock_outlined,
            ),
          ),
          _HeaderIconButton(
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
            icon: const Icon(
              Icons.more_vert_rounded,
              color: Color(0xFF54656F),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.tooltip,
    required this.onPressed,
    required this.icon,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget icon;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        foregroundColor: const Color(0xFF54656F),
        backgroundColor: Colors.transparent,
        hoverColor: Colors.white.withValues(alpha: 0.65),
        highlightColor: Colors.white.withValues(alpha: 0.8),
      ),
      icon: icon,
    );
  }
}

ImageProvider? _normalizedChatAvatarProvider(String? candidate) {
  final trimmed = candidate?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  final uri = Uri.tryParse(trimmed);
  if (uri == null) {
    return null;
  }

  if (uri.scheme == 'http' || uri.scheme == 'https') {
    return CachedNetworkImageProvider(trimmed);
  }

  return null;
}

class _MessageViewport extends StatefulWidget {
  const _MessageViewport({
    required this.controller,
    required this.scrollController,
    required this.onNearBottomChanged,
  });

  final BotCenterController controller;
  final ScrollController scrollController;
  final ValueChanged<bool> onNearBottomChanged;

  @override
  State<_MessageViewport> createState() => _MessageViewportState();
}

class _MessageViewportState extends State<_MessageViewport> {
  var _lastRenderedMessageCount = 0;
  String _lastConversationId = '';
  String _lastMessageIdentity = '';
  bool _shouldStickToBottom = true;

  @override
  void initState() {
    super.initState();
    widget.scrollController.addListener(_handleScrollChange);
  }

  @override
  void didUpdateWidget(covariant _MessageViewport oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController == widget.scrollController) {
      return;
    }

    oldWidget.scrollController.removeListener(_handleScrollChange);
    widget.scrollController.addListener(_handleScrollChange);
  }

  @override
  void dispose() {
    widget.scrollController.removeListener(_handleScrollChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    if (controller.isConversationLoading) {
      _publishNearBottomState(true);
      return const Center(
        child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 3)),
      );
    }

    if (controller.selectedMessages.isEmpty) {
      _publishNearBottomState(true);
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

    final messages = controller.selectedMessages;

    return Scrollbar(
      controller: widget.scrollController,
      child: ListView.builder(
        controller: widget.scrollController,
        padding: const EdgeInsets.fromLTRB(6, 8, 6, 12),
        itemCount: messages.length,
        itemBuilder: (context, index) {
          final message = messages[index];
          final previousMessage = index > 0 ? messages[index - 1] : null;
          final nextMessage =
              index + 1 < messages.length ? messages[index + 1] : null;
          final groupedWithPrevious =
              _messagesBelongToSameVisualGroup(previousMessage, message);
          final groupedWithNext =
              _messagesBelongToSameVisualGroup(message, nextMessage);

          return Padding(
            padding: EdgeInsets.only(
              top: groupedWithPrevious ? 1.5 : 7,
              bottom: groupedWithNext ? 1.5 : 9,
            ),
            child: KeyedSubtree(
              key: ValueKey(
                '${message.id}:${message.state.name}:${message.timestamp.microsecondsSinceEpoch}',
              ),
              child: _MessageBubble(
                controller: controller,
                message: message,
                previousMessage: previousMessage,
                nextMessage: nextMessage,
              ),
            ),
          );
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
      if (!mounted || !widget.scrollController.hasClients) {
        return;
      }

      if (!shouldAutoScroll) {
        _publishNearBottomState(false);
        return;
      }

      final position = widget.scrollController.position.maxScrollExtent;
      if (conversationChanged) {
        widget.scrollController.jumpTo(position);
      } else {
        unawaited(widget.scrollController.animateTo(
          position,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        ));
      }

      _publishNearBottomState(true);
    });
  }

  void _handleScrollChange() {
    if (!widget.scrollController.hasClients) {
      return;
    }

    final distanceToBottom = widget.scrollController.position.maxScrollExtent -
        widget.scrollController.offset;
    final isNearBottom = distanceToBottom <= 72;
    _shouldStickToBottom = isNearBottom;
    _publishNearBottomState(isNearBottom);
  }

  void _publishNearBottomState(bool isNearBottom) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      widget.onNearBottomChanged(isNearBottom);
    });
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
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F2F5),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E5E7)),
      ),
      child: Row(
        children: [
          Material(
            color: Colors.white,
            shape: const CircleBorder(),
            child: IconButton(
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
                                ListTile(
                                  leading: const Icon(
                                      Icons.insert_drive_file_outlined),
                                  title: const Text('Enviar documento'),
                                  onTap: () => Navigator.of(sheetContext)
                                      .pop(BotMessageType.document),
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
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 46),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE2E5E7)),
              ),
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
                          hintText: 'Escribe un mensaje',
                          hintStyle: theme.textTheme.bodyMedium?.copyWith(
                            fontSize: 13,
                            color: const Color(0xFF8696A0),
                          ),
                          border: InputBorder.none,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 8),
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
          ),
          const SizedBox(width: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: controller.hasDraftMessage || isRecording
                ? SizedBox(
                    key: const ValueKey('send-action'),
                    width: 42,
                    height: 42,
                    child: FilledButton(
                      onPressed: canSend ? sendMessage : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF00A884),
                        padding: EdgeInsets.zero,
                        shape: const CircleBorder(),
                      ),
                      child: controller.isSendingMessage ||
                              controller.isPreparingAudio
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor:
                                    AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                    ),
                  )
                : Tooltip(
                    key: const ValueKey('record-action'),
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
                                  ? const Color(0xFF00A884)
                                  : const Color(0xFF94A3B8),
                          shape: BoxShape.circle,
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
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
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
  const _MessageBubble({
    required this.controller,
    required this.message,
    this.previousMessage,
    this.nextMessage,
  });

  final BotCenterController controller;
  final BotMessage message;
  final BotMessage? previousMessage;
  final BotMessage? nextMessage;

  @override
  Widget build(BuildContext context) {
    final isIncoming = message.isIncoming;
    final isSystem = message.author == BotMessageAuthor.system;
    final isOutgoing = !isIncoming && !isSystem;
    final startsVisualGroup =
        !_messagesBelongToSameVisualGroup(previousMessage, message);
    final endsVisualGroup =
        !_messagesBelongToSameVisualGroup(message, nextMessage);
    final contactPhoneNumber = _resolveSelectedContactPhoneNumber(controller);
    final showAuthorLabel = startsVisualGroup &&
        (isSystem || message.author == BotMessageAuthor.bot || isIncoming);
    final bubbleColor = isOutgoing
        ? const Color(0xFFD9FDD3)
        : isSystem
            ? const Color(0xFFE2E8F0)
            : Colors.white;
    final textColor = const Color(0xFF111B21);
    final metaColor =
        isOutgoing ? const Color(0xFF667781) : const Color(0xFF667781);
    final alignment = isOutgoing ? Alignment.centerRight : Alignment.centerLeft;
    final timeLabel = formatConversationTimestamp(message.timestamp);
    final displayText = message.caption?.trim().isNotEmpty == true
        ? message.caption!
        : message.body;
    final hasDisplayText = !message.isAudio &&
        (!message.isDocument || message.caption?.trim().isNotEmpty == true) &&
        displayText.trim().isNotEmpty;

    return LayoutBuilder(
      builder: (context, constraints) {
        final mediaHeavy = message.hasVisualMedia || message.isAudio;
        final maxWidthFactor = constraints.maxWidth >= 1200
            ? (mediaHeavy ? 0.84 : 0.72)
            : constraints.maxWidth >= 840
                ? (mediaHeavy ? 0.8 : 0.72)
                : (mediaHeavy ? 0.9 : 0.82);

        return Align(
          alignment: alignment,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: constraints.maxWidth * maxWidthFactor,
            ),
            child: Padding(
              padding: EdgeInsets.only(
                left: isOutgoing ? (startsVisualGroup ? 26 : 38) : 0,
                right: isOutgoing ? 0 : (startsVisualGroup ? 26 : 38),
              ),
              child: Column(
                crossAxisAlignment: isOutgoing
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (showAuthorLabel) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        _senderLabel(
                          message.author,
                          contactPhoneNumber: contactPhoneNumber,
                        ),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontSize: 10.5,
                              color: metaColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    const SizedBox(height: 4),
                  ],
                  Container(
                    padding: EdgeInsets.fromLTRB(
                      message.hasVisualMedia ? 8 : 12,
                      message.isAudio ? 10 : 8,
                      message.hasVisualMedia ? 8 : 12,
                      7,
                    ),
                    decoration: BoxDecoration(
                      color: bubbleColor,
                      borderRadius: _messageBubbleBorderRadius(
                        isOutgoing: isOutgoing,
                        isSystem: isSystem,
                        startsVisualGroup: startsVisualGroup,
                        endsVisualGroup: endsVisualGroup,
                      ),
                      border: isOutgoing || isSystem
                          ? isOutgoing
                              ? Border.all(color: const Color(0xFFCFE9C9))
                              : null
                          : Border.all(color: const Color(0xFFE7EAED)),
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
                        else if (message.isDocument)
                          _DocumentMessageCard(
                            controller: controller,
                            message: message,
                            isOutgoing: isOutgoing,
                          )
                        else if (message.hasVisualMedia)
                          _MessageMedia(
                            controller: controller,
                            message: message,
                            isOutgoing: isOutgoing,
                          ),
                        if (hasDisplayText) ...[
                          if (message.hasVisualMedia ||
                              message.isAudio ||
                              message.isDocument)
                            const SizedBox(height: 8),
                          Text(
                            displayText,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  fontSize: 13,
                                  color: textColor,
                                  height: 1.32,
                                ),
                          ),
                        ],
                        const SizedBox(height: 6),
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
                                      ? const Color(0xFF00A884)
                                      : const Color(0xFF00A884),
                                ),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints.tightFor(
                                  width: 24,
                                  height: 24,
                                ),
                              ),
                              const SizedBox(width: 4),
                            ],
                            Text(
                              timeLabel,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    fontSize: 10,
                                    color: metaColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            if (message.author ==
                                BotMessageAuthor.operator) ...[
                              const SizedBox(width: 5),
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
          ),
        );
      },
    );
  }
}

bool _messagesBelongToSameVisualGroup(BotMessage? current, BotMessage? other) {
  if (current == null || other == null) {
    return false;
  }

  final currentIsSystem = current.author == BotMessageAuthor.system;
  final otherIsSystem = other.author == BotMessageAuthor.system;
  if (currentIsSystem || otherIsSystem) {
    return false;
  }

  final sameDirection = current.isIncoming == other.isIncoming;
  final sameAuthor = current.author == other.author;
  final withinGroupWindow =
      current.timestamp.difference(other.timestamp).abs().inMinutes <= 6;

  return sameDirection && sameAuthor && withinGroupWindow;
}

BorderRadius _messageBubbleBorderRadius({
  required bool isOutgoing,
  required bool isSystem,
  required bool startsVisualGroup,
  required bool endsVisualGroup,
}) {
  if (isSystem) {
    return BorderRadius.circular(18);
  }

  if (isOutgoing) {
    return BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: Radius.circular(startsVisualGroup ? 18 : 7),
      bottomLeft: const Radius.circular(18),
      bottomRight: Radius.circular(endsVisualGroup ? 4 : 7),
    );
  }

  return BorderRadius.only(
    topLeft: Radius.circular(startsVisualGroup ? 18 : 7),
    topRight: const Radius.circular(18),
    bottomLeft: Radius.circular(endsVisualGroup ? 4 : 7),
    bottomRight: const Radius.circular(18),
  );
}

class _MessageMedia extends StatefulWidget {
  const _MessageMedia({
    required this.controller,
    required this.message,
    required this.isOutgoing,
  });

  final BotCenterController controller;
  final BotMessage message;
  final bool isOutgoing;

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
      unawaited(_hydrateVisibleMedia());
    });
  }

  Future<void> _hydrateVisibleMedia() async {
    await widget.controller.ensureMessagePreviewLoaded(widget.message);

    final refreshed = widget.controller.findMessageById(
            widget.message.conversationId, widget.message.id) ??
        widget.message;
    final hasRenderablePreview =
        _resolveInlinePreviewBytes(refreshed) != null ||
            _resolvePreviewUrl(refreshed) != null;

    if (!hasRenderablePreview && refreshed.isImage) {
      await widget.controller.ensureMessagePlayableLoaded(refreshed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final previewBytes = _resolveInlinePreviewBytes(message);
    final previewUrl = _resolvePreviewUrl(message);
    final hasVisual = previewBytes != null || previewUrl != null;
    final containerColor =
        widget.isOutgoing ? const Color(0xFFEFFBD8) : Colors.white;
    final containerBorderColor =
        widget.isOutgoing ? const Color(0xFFB7E3AE) : const Color(0xFFE2E8F0);
    final chipColor =
        widget.isOutgoing ? const Color(0xFFD9FDD3) : const Color(0xFFF8FAFC);
    final mediaLabel = message.fileName?.trim().isNotEmpty == true
        ? message.fileName!
        : (message.isImage ? 'Imagen' : 'Video');

    return GestureDetector(
      onTap: () async {
        if (message.isImage) {
          if (previewBytes == null && previewUrl == null) {
            await widget.controller.ensureMessagePreviewLoaded(message);
          }
          await widget.controller.ensureMessagePlayableLoaded(message);
          final resolved = widget.controller
                  .findMessageById(message.conversationId, message.id) ??
              message;
          final resolvedPreview = _resolveInlinePreviewBytes(resolved);
          final resolvedPreviewUrl = _resolvePreviewUrl(resolved);
          if (resolvedPreview == null && resolvedPreviewUrl == null) {
            return;
          }
          if (!context.mounted) {
            return;
          }
          showDialog<void>(
            context: context,
            builder: (_) => _ImagePreviewDialog(message: resolved),
          );
        } else if (message.isVideo) {
          if (!context.mounted) {
            return;
          }
          showDialog<void>(
            context: context,
            builder: (_) => _VideoPreviewDialog(
              controller: widget.controller,
              message: message,
            ),
          );
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final mediaWidth = math.min(constraints.maxWidth, 280.0);

            return ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: 280,
                maxHeight: 200,
              ),
              child: SizedBox(
                width: mediaWidth,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: containerColor,
                        border: Border.all(
                          color: containerBorderColor,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: message.isVideo
                          ? _VideoMessageThumbnailCard(
                              message: message,
                              previewBytes: previewBytes,
                              previewUrl: previewUrl,
                              mediaLabel: mediaLabel,
                              isOutgoing: widget.isOutgoing,
                            )
                          : Stack(
                              fit: StackFit.expand,
                              children: [
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        containerColor,
                                        Color(0xFFF8FAFC),
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
                                          Colors.white.withValues(alpha: 0.02),
                                          Colors.black.withValues(alpha: 0.08),
                                        ],
                                        stops: const [0.0, 0.66, 1.0],
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
                                                color: const Color(0xFF0F172A),
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
                                          color: chipColor,
                                          borderRadius:
                                              BorderRadius.circular(999),
                                          border: Border.all(
                                            color: containerBorderColor,
                                          ),
                                        ),
                                        child: const Text(
                                          'Foto',
                                          style: TextStyle(
                                            color: Color(0xFF334155),
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
                    if (message.state == BotMessageState.queued)
                      Container(
                        color: Colors.white.withValues(alpha: 0.55),
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

class _VideoMessageThumbnailCard extends StatefulWidget {
  const _VideoMessageThumbnailCard({
    required this.message,
    required this.previewBytes,
    required this.previewUrl,
    required this.mediaLabel,
    required this.isOutgoing,
  });

  final BotMessage message;
  final Uint8List? previewBytes;
  final String? previewUrl;
  final String mediaLabel;
  final bool isOutgoing;

  @override
  State<_VideoMessageThumbnailCard> createState() =>
      _VideoMessageThumbnailCardState();
}

class _VideoMessageThumbnailCardState
    extends State<_VideoMessageThumbnailCard> {
  Future<Uint8List?>? _generatedThumbnailFuture;

  @override
  void initState() {
    super.initState();
    _ensureGeneratedThumbnail();
  }

  @override
  void didUpdateWidget(covariant _VideoMessageThumbnailCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message.id != widget.message.id ||
        oldWidget.message.mediaUrl != widget.message.mediaUrl ||
        oldWidget.message.localFileBytes != widget.message.localFileBytes ||
        oldWidget.previewUrl != widget.previewUrl ||
        oldWidget.previewBytes != widget.previewBytes) {
      _generatedThumbnailFuture = null;
      _ensureGeneratedThumbnail();
    }
  }

  void _ensureGeneratedThumbnail() {
    if (widget.previewBytes != null || widget.previewUrl != null) {
      return;
    }

    _generatedThumbnailFuture ??=
        _VideoThumbnailCache.resolve(widget.message, _buildVideoThumbnail);
  }

  Future<Uint8List?> _buildVideoThumbnail() async {
    final localBytes = widget.message.localFileBytes;
    if (localBytes != null && localBytes.isNotEmpty) {
      final directory = await Directory.systemTemp.createTemp(
        'bot-center-thumb-',
      );
      final extension = _fileExtension(widget.message.fileName ?? 'video.mp4');
      final file =
          File('${directory.path}${Platform.pathSeparator}video.$extension');
      await file.writeAsBytes(localBytes, flush: true);
      try {
        debugPrint(
          '[BOT_CENTER_VIDEO] thumbnail source=local messageId=${widget.message.id} bytes=${localBytes.length} file=${file.path}',
        );
        return await video_thumbnail.VideoThumbnail.thumbnailData(
          video: file.path,
          imageFormat: video_thumbnail.ImageFormat.JPEG,
          maxWidth: 560,
          quality: 72,
          timeMs: 0,
        );
      } catch (error) {
        debugPrint(
          '[BOT_CENTER_VIDEO] thumbnail local error messageId=${widget.message.id} error=$error',
        );
        return null;
      } finally {
        unawaited(directory.delete(recursive: true));
      }
    }

    final remoteUrl = _resolvePlayableVideoUrl(widget.message);
    if (remoteUrl == null) {
      return null;
    }

    try {
      debugPrint(
        '[BOT_CENTER_VIDEO] thumbnail source=remote messageId=${widget.message.id} mediaUrl=$remoteUrl',
      );
      return await video_thumbnail.VideoThumbnail.thumbnailData(
        video: remoteUrl,
        imageFormat: video_thumbnail.ImageFormat.JPEG,
        maxWidth: 560,
        quality: 72,
        timeMs: 0,
      );
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_VIDEO] thumbnail remote error messageId=${widget.message.id} mediaUrl=$remoteUrl error=$error',
      );
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaceColor =
        widget.isOutgoing ? const Color(0xFFEFFBD8) : const Color(0xFFFFFFFF);
    final surfaceBorderColor =
        widget.isOutgoing ? const Color(0xFFB7E3AE) : const Color(0xFFE2E8F0);
    final durationLabel = _resolveVideoDurationLabel(widget.message);

    return FutureBuilder<Uint8List?>(
      future: _generatedThumbnailFuture,
      builder: (context, snapshot) {
        final generatedBytes = snapshot.data;
        final isGenerating =
            snapshot.connectionState == ConnectionState.waiting;

        return ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: 280,
            maxHeight: 200,
          ),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          surfaceColor,
                          Color(0xFFF8FAFC),
                        ],
                      ),
                    ),
                    child: _buildThumbnailVisual(
                      generatedBytes,
                      isGenerating: isGenerating,
                    ),
                  ),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0.04),
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.16),
                        ],
                        stops: const [0.0, 0.56, 1.0],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: surfaceBorderColor),
                    ),
                    child: const Icon(
                      Icons.videocam_rounded,
                      color: Color(0xFF475569),
                      size: 14,
                    ),
                  ),
                ),
                Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: surfaceBorderColor,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x180F172A),
                          blurRadius: 16,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: Color(0xFF0F172A),
                      size: 38,
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 10,
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.92),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: surfaceBorderColor),
                        ),
                        child: const Text(
                          'Video',
                          style: TextStyle(
                            color: Color(0xFF334155),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (durationLabel != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: surfaceBorderColor),
                          ),
                          child: Text(
                            durationLabel,
                            style: const TextStyle(
                              color: Color(0xFF334155),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (widget.mediaLabel.trim().isNotEmpty)
                  Positioned(
                    left: 12,
                    right: 72,
                    bottom: 42,
                    child: Text(
                      widget.mediaLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: const Color(0xFF0F172A),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildThumbnailVisual(
    Uint8List? generatedBytes, {
    required bool isGenerating,
  }) {
    if (widget.previewBytes != null) {
      return Image.memory(
        widget.previewBytes!,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => _videoThumbnailFallback(),
      );
    }

    if (widget.previewUrl != null) {
      return CachedNetworkImage(
        imageUrl: widget.previewUrl!,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (_, __) => const _MediaLoadingPlaceholder(),
        errorWidget: (_, __, ___) => _videoThumbnailFallback(),
      );
    }

    if (generatedBytes != null && generatedBytes.isNotEmpty) {
      return Image.memory(
        generatedBytes,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => _videoThumbnailFallback(),
      );
    }

    if (widget.message.state == BotMessageState.queued || isGenerating) {
      return const _MediaLoadingPlaceholder();
    }

    return _videoThumbnailFallback();
  }

  Widget _videoThumbnailFallback() {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFFFFF),
            Color(0xFFF8FAFC),
            Color(0xFFF1F5F9),
          ],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            left: -16,
            top: -10,
            child: Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            right: -24,
            bottom: -20,
            child: Container(
              width: 130,
              height: 130,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.movie_creation_outlined,
                  color: const Color(0xFF64748B),
                  size: 38,
                ),
                const SizedBox(height: 10),
                Text(
                  'Toca para reproducir',
                  style: TextStyle(
                    color: const Color(0xFF64748B),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VideoThumbnailCache {
  static final Map<String, Uint8List> _cache = <String, Uint8List>{};
  static final Map<String, Future<Uint8List?>> _pending =
      <String, Future<Uint8List?>>{};

  static Future<Uint8List?> resolve(
    BotMessage message,
    Future<Uint8List?> Function() loader,
  ) {
    final key = _cacheKey(message);
    final cached = _cache[key];
    if (cached != null && cached.isNotEmpty) {
      return Future<Uint8List?>.value(cached);
    }

    final inFlight = _pending[key];
    if (inFlight != null) {
      return inFlight;
    }

    final future = loader().then((bytes) {
      if (bytes != null && bytes.isNotEmpty) {
        _cache[key] = bytes;
      }
      _pending.remove(key);
      return bytes;
    });
    _pending[key] = future;
    return future;
  }

  static String _cacheKey(BotMessage message) {
    return [
      message.id,
      message.mediaUrl ?? '',
      message.thumbnailUrl ?? '',
      message.fileName ?? '',
      '${message.localFileBytes?.length ?? 0}',
    ].join('|');
  }
}

class _DocumentMessageCard extends StatelessWidget {
  const _DocumentMessageCard({
    required this.controller,
    required this.message,
    required this.isOutgoing,
  });

  final BotCenterController controller;
  final BotMessage message;
  final bool isOutgoing;

  @override
  Widget build(BuildContext context) {
    final surfaceColor =
        isOutgoing ? const Color(0xFFEFFBD8) : const Color(0xFFFFFFFF);
    final borderColor =
        isOutgoing ? const Color(0xFFB7E3AE) : const Color(0xFFE2E8F0);
    final accentColor =
        isOutgoing ? const Color(0xFF00A884) : const Color(0xFF334155);
    final label = message.fileName?.trim().isNotEmpty == true
        ? message.fileName!
        : 'Documento';
    final subtitle = _documentTypeLabel(message.mimeType);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Icon(
                _documentIcon(message.mimeType),
                color: accentColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF0F172A),
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Descargar documento',
              onPressed: () async {
                try {
                  await controller.ensureMessagePlayableLoaded(message);
                  final savedPath =
                      await controller.downloadMessageAsset(message);
                  if (!context.mounted || savedPath == null) {
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Archivo guardado en $savedPath')),
                  );
                } catch (error) {
                  if (!context.mounted) {
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('No se pudo descargar el archivo. $error'),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.download_rounded),
              color: accentColor,
            ),
          ],
        ),
      ),
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
  late final just_audio.AudioPlayer _player;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;
  StreamSubscription<just_audio.PlayerState>? _playerStateSubscription;
  File? _tempFile;
  String? _openedSourceKey;
  String? _errorMessage;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _player = just_audio.AudioPlayer();
    _scheduleAudioHydration();
    _positionSubscription = _player.positionStream.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() => _position = value);
    });
    _durationSubscription = _player.durationStream.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() => _duration = value ?? Duration.zero);
    });
    _playerStateSubscription = _player.playerStateStream.listen((value) async {
      if (!mounted) {
        return;
      }
      if (value.processingState == just_audio.ProcessingState.completed) {
        await _player.pause();
        await _player.seek(Duration.zero);
        if (_activeAudioMessageId.value == widget.message.id) {
          _activeAudioMessageId.value = null;
        }
      }

      setState(() => _isPlaying = value.playing);
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
      _scheduleAudioHydration();
    }
  }

  void _scheduleAudioHydration() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.message.localFileBytes != null) {
        return;
      }

      unawaited(widget.controller.ensureMessagePlayableLoaded(widget.message));
    });
  }

  @override
  void dispose() {
    _activeAudioMessageId.removeListener(_handleActiveAudioChanged);
    unawaited(_positionSubscription?.cancel());
    unawaited(_durationSubscription?.cancel());
    unawaited(_playerStateSubscription?.cancel());
    unawaited(_player.dispose());
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
    final accent =
        widget.isOutgoing ? const Color(0xFF00A884) : const Color(0xFF0F172A);
    final secondary = const Color(0xFF64748B);
    final waveformInactive = widget.isOutgoing
        ? const Color(0xFF7CC7B8).withValues(alpha: 0.45)
        : secondary.withValues(alpha: 0.22);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: widget.isOutgoing
              ? const Color(0xFFD9FDD3)
              : const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(18),
          border: widget.isOutgoing
              ? null
              : Border.all(color: const Color(0xFFE7EAED)),
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
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: widget.isOutgoing
                          ? const Color(0xFF00A884)
                          : const Color(0xFFE9EDEF),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      _isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      color: widget.isOutgoing
                          ? Colors.white
                          : const Color(0xFF54656F),
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
                        inactiveColor: waveformInactive,
                        onSeekFraction: totalDuration.inMilliseconds > 0
                            ? (fraction) =>
                                _seekToFraction(fraction, totalDuration)
                            : null,
                      ),
                      const SizedBox(height: 6),
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
                          if (widget.message.isIncoming) ...[
                            const Icon(
                              Icons.mic_rounded,
                              size: 12,
                              color: Color(0xFF667781),
                            ),
                            const SizedBox(width: 4),
                          ],
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
                        ? const Color(0xFFDC2626)
                        : const Color(0xFFDC2626),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: widget.isOutgoing
                                ? const Color(0xFFB91C1C)
                                : const Color(0xFFB91C1C),
                            fontSize: 11.5,
                          ),
                    ),
                  ),
                  TextButton(
                    onPressed: _retryPlayback,
                    child: Text(
                      'Reintentar',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: widget.isOutgoing
                                ? const Color(0xFF1D4ED8)
                                : const Color(0xFF1D4ED8),
                            fontWeight: FontWeight.w700,
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
    var candidate = widget.message;
    if (candidate.localFileBytes == null || candidate.localFileBytes!.isEmpty) {
      await widget.controller.ensureMessagePlayableLoaded(candidate);
      candidate = widget.controller
              .findMessageById(candidate.conversationId, candidate.id) ??
          candidate;
    }

    final ready = await _ensureSourceReady(candidate);
    if (!ready) {
      return;
    }

    try {
      await _player.play();
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_AUDIO] play error messageId=${candidate.id} mediaUrl=${candidate.mediaUrl ?? '(none)'} error=$error',
      );
      if (mounted) {
        setState(() {
          _errorMessage = 'No se pudo iniciar la reproducción.';
        });
      }
    }
  }

  Future<bool> _ensureSourceReady(BotMessage candidate) async {
    final remoteUrl = _resolvePlayableAudioUrl(candidate);

    // On Windows/iOS, prefer remoteUrl over local files due to platform limitations
    final isDesktopOrIos = Platform.isWindows || Platform.isIOS;

    // Try local bytes first (only on Android/macOS where it's reliable)
    if (!isDesktopOrIos) {
      final localBytes = candidate.localFileBytes;
      if (localBytes != null && localBytes.isNotEmpty) {
        final nextKey = 'local:${candidate.id}:${localBytes.length}';
        if (_openedSourceKey == nextKey) {
          return true;
        }

        try {
          final directory =
              await Directory.systemTemp.createTemp('bot-center-audio-');
          final extension = _resolveAudioTempExtension(candidate);
          final file = File(
            '${directory.path}${Platform.pathSeparator}audio.$extension',
          );
          await file.writeAsBytes(localBytes, flush: true);

          final previousFile = _tempFile;
          _tempFile = file;
          if (previousFile != null) {
            unawaited(previousFile.parent.delete(recursive: true));
          }

          debugPrint(
            '[BOT_CENTER_AUDIO] setFilePath messageId=${candidate.id} path=${file.path}',
          );
          await _player.setFilePath(file.path);
          _openedSourceKey = nextKey;
          if (mounted) {
            setState(() => _errorMessage = null);
          }
          return true;
        } catch (error) {
          debugPrint(
            '[BOT_CENTER_AUDIO] local load error messageId=${candidate.id} error=$error',
          );
          // Fall through to try remote URL
        }
      }
    }

    // Fall back to remote URL
    if (remoteUrl == null) {
      debugPrint(
        '[BOT_CENTER_AUDIO] invalid mediaUrl messageId=${candidate.id} mediaUrl=${candidate.mediaUrl ?? '(none)'}',
      );
      if (mounted) {
        setState(() {
          _errorMessage = 'El audio no tiene una URL válida.';
        });
      }
      return false;
    }

    final nextKey = 'remote:$remoteUrl';
    if (_openedSourceKey == nextKey) {
      return true;
    }

    try {
      debugPrint(
        '[BOT_CENTER_AUDIO] setUrl messageId=${candidate.id} mediaUrl=$remoteUrl',
      );
      await _player.setUrl(remoteUrl);
      _openedSourceKey = nextKey;
      if (mounted) {
        setState(() => _errorMessage = null);
      }
      return true;
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_AUDIO] remote load error messageId=${candidate.id} mediaUrl=$remoteUrl error=$error',
      );

      final refreshedCandidate = await _refreshMessageCandidate(candidate);
      final refreshedUrl = _resolvePlayableAudioUrl(refreshedCandidate);
      if (refreshedUrl != null && refreshedUrl != remoteUrl) {
        try {
          debugPrint(
            '[BOT_CENTER_AUDIO] retry setUrl messageId=${refreshedCandidate.id} mediaUrl=$refreshedUrl',
          );
          await _player.setUrl(refreshedUrl);
          _openedSourceKey = 'remote:$refreshedUrl';
          if (mounted) {
            setState(() => _errorMessage = null);
          }
          return true;
        } catch (retryError) {
          debugPrint(
            '[BOT_CENTER_AUDIO] retry load error messageId=${refreshedCandidate.id} mediaUrl=$refreshedUrl error=$retryError',
          );
        }
      }

      if (mounted) {
        setState(() {
          _errorMessage =
              'No se pudo cargar el audio. Reintenta para refrescar la URL.';
        });
      }
      return false;
    }
  }

  Future<BotMessage> _refreshMessageCandidate(BotMessage candidate) async {
    try {
      await widget.controller.selectConversation(
        candidate.conversationId,
        forceReload: true,
      );
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_AUDIO] refresh error messageId=${candidate.id} error=$error',
      );
    }

    return widget.controller
            .findMessageById(candidate.conversationId, candidate.id) ??
        candidate;
  }

  Future<void> _retryPlayback() async {
    if (mounted) {
      setState(() {
        _openedSourceKey = null;
        _errorMessage = null;
        _position = Duration.zero;
        _duration = Duration.zero;
      });
    }

    await _player.stop();
    final candidate = await _refreshMessageCandidate(widget.message);
    _activeAudioMessageId.value = widget.message.id;
    final ready = await _ensureSourceReady(candidate);
    if (!ready) {
      return;
    }

    try {
      await _player.play();
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_AUDIO] retry play error messageId=${candidate.id} mediaUrl=${candidate.mediaUrl ?? '(none)'} error=$error',
      );
      if (mounted) {
        setState(() {
          _errorMessage = 'No se pudo iniciar la reproducción.';
        });
      }
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
      backgroundColor: const Color(0xFF00A884),
      foregroundColor: Colors.white,
      elevation: 4,
      highlightElevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
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

  if (message.isImage && _isValidImageBytes(message.localFileBytes)) {
    return message.localFileBytes;
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

String _resolveAudioTempExtension(BotMessage message) {
  final fileName = message.fileName?.trim();
  if (fileName != null && fileName.isNotEmpty) {
    return _fileExtension(fileName);
  }

  final mimeType = message.mimeType?.trim().toLowerCase();
  switch (mimeType) {
    case 'audio/ogg':
    case 'audio/opus':
      return 'mp3'; // Backend converts OGG/opus to MP3
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/aac':
      return 'm4a';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    default:
      return 'mp3';
  }
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
      color: const Color(0xFFF8FAFC),
      alignment: Alignment.center,
      child: const SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(
          strokeWidth: 2.6,
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF94A3B8)),
        ),
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
      color: const Color(0xFFF8FAFC),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: const Color(0xFF94A3B8),
            size: 40,
          ),
          const SizedBox(height: 10),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF64748B),
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
  const _VideoPreviewDialog({
    required this.controller,
    required this.message,
  });

  final BotCenterController controller;
  final BotMessage message;

  @override
  State<_VideoPreviewDialog> createState() => _VideoPreviewDialogState();
}

class _VideoPreviewDialogState extends State<_VideoPreviewDialog> {
  late final Player _player;
  late final VideoController _videoController;
  StreamSubscription<bool>? _playingSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration?>? _durationSubscription;
  File? _tempFile;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player = Player();
    _videoController = VideoController(_player);
    _playingSubscription = _player.stream.playing.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isPlaying = value;
      });
    });
    _positionSubscription = _player.stream.position.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() {
        _position = value;
      });
    });
    _durationSubscription = _player.stream.duration.listen((value) {
      if (!mounted) {
        return;
      }
      setState(() {
        _duration = value;
      });
    });
    _player.stream.log.listen((event) {
      debugPrint(
        '[BOT_CENTER_VIDEO] player-log messageId=${widget.message.id} level=${event.level} text=${event.text}',
      );
    });
    _player.stream.error.listen((error) {
      debugPrint(
        '[BOT_CENTER_VIDEO] player-error messageId=${widget.message.id} error=$error',
      );
    });
    unawaited(_openVideo());
  }

  Future<void> _openVideo() async {
    try {
      var resolved = widget.controller.findMessageById(
              widget.message.conversationId, widget.message.id) ??
          widget.message;

      if (resolved.localFileBytes?.isNotEmpty != true &&
          _resolvePlayableVideoUrl(resolved) == null) {
        await widget.controller.ensureMessagePlayableLoaded(resolved);
        resolved = widget.controller.findMessageById(
                widget.message.conversationId, widget.message.id) ??
            resolved;
      }

      final media = await _buildVideoMedia(resolved);
      if (media == null) {
        throw StateError('Video source not available');
      }

      debugPrint(
        '[BOT_CENTER_VIDEO] open messageId=${resolved.id} mediaUrl=${resolved.mediaUrl ?? '(none)'} localBytes=${resolved.localFileBytes?.length ?? 0}',
      );
      await _player.open(media);
      await _player.play();
      if (!mounted) {
        return;
      }

      setState(() {
        _isLoading = false;
        _errorMessage = null;
      });
      return;
    } catch (error) {
      debugPrint(
        '[BOT_CENTER_VIDEO] open error messageId=${widget.message.id} mediaUrl=${widget.message.mediaUrl ?? '(none)'} error=$error',
      );
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'No se pudo cargar el video. Verifica URL o codec.';
      });
    }
  }

  Future<Media?> _buildVideoMedia(
    BotMessage message,
  ) async {
    final localBytes = message.localFileBytes;
    if (localBytes != null && localBytes.isNotEmpty) {
      final directory =
          await Directory.systemTemp.createTemp('bot-center-video-');
      final extension = _fileExtension(message.fileName ?? 'video.mp4');
      final file = File(
        '${directory.path}${Platform.pathSeparator}video.$extension',
      );
      await file.writeAsBytes(localBytes, flush: true);
      _tempFile = file;
      return Media(file.path);
    }

    final remoteUrl = _resolvePlayableVideoUrl(message);
    if (remoteUrl != null) {
      return Media(remoteUrl);
    }

    return null;
  }

  @override
  void dispose() {
    unawaited(_playingSubscription?.cancel());
    unawaited(_positionSubscription?.cancel());
    unawaited(_durationSubscription?.cancel());
    _player.dispose();
    final file = _tempFile;
    if (file != null) {
      unawaited(file.parent.delete(recursive: true));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasVideo = !_isLoading && _errorMessage == null;

    return Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: Stack(
        children: [
          Positioned.fill(
            child: ColoredBox(
              color: Colors.black,
              child: SafeArea(
                child: Center(
                  child: _errorMessage != null
                      ? Container(
                          width: 360,
                          constraints: const BoxConstraints(maxWidth: 360),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: const Color(0xFF111827),
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
                      : _isLoading
                          ? const _MediaLoadingPlaceholder()
                          : GestureDetector(
                              onTap: _togglePlayback,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  Center(
                                    child: AspectRatio(
                                      aspectRatio: _resolvedVideoAspectRatio(),
                                      child:
                                          Video(controller: _videoController),
                                    ),
                                  ),
                                  if (!_isPlaying)
                                    Container(
                                      width: 84,
                                      height: 84,
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(
                                          alpha: 0.54,
                                        ),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.play_arrow_rounded,
                                        color: Colors.white,
                                        size: 52,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                ),
              ),
            ),
          ),
          Positioned(
            top: 18,
            left: 18,
            child: IconButton.filled(
              style: IconButton.styleFrom(
                backgroundColor: Colors.black.withValues(alpha: 0.52),
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
          if (hasVideo)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.84),
                    ],
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 4,
                        value: _progressValue(),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          theme.colorScheme.primary,
                        ),
                        backgroundColor: Colors.white24,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        IconButton(
                          onPressed: _togglePlayback,
                          icon: Icon(
                            _isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${_formatAudioDuration(_position)} / ${_formatAudioDuration(_duration)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          widget.message.fileName?.trim().isNotEmpty == true
                              ? widget.message.fileName!
                              : 'Video',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _togglePlayback() async {
    if (_isPlaying) {
      await _player.pause();
      return;
    }

    await _player.play();
  }

  double _resolvedVideoAspectRatio() {
    final width = _videoController.player.state.width ?? 16;
    final height = _videoController.player.state.height ?? 9;
    if (width <= 0 || height <= 0) {
      return 16 / 9;
    }

    return width / height;
  }

  double _progressValue() {
    if (_duration.inMilliseconds <= 0) {
      return 0;
    }

    return (_position.inMilliseconds / _duration.inMilliseconds).clamp(0, 1);
  }
}

String? _resolveVideoDurationLabel(BotMessage message) {
  final seconds = message.durationSeconds;
  if (seconds == null || seconds <= 0) {
    return null;
  }

  return _formatAudioDuration(Duration(seconds: seconds));
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

String _documentTypeLabel(String? mimeType) {
  switch ((mimeType ?? '').toLowerCase()) {
    case 'application/pdf':
      return 'PDF';
    case 'text/plain':
      return 'TXT';
    case 'text/csv':
      return 'CSV';
    case 'application/msword':
      return 'DOC';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'DOCX';
    case 'application/vnd.ms-excel':
      return 'XLS';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'XLSX';
    case 'application/vnd.ms-powerpoint':
      return 'PPT';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'PPTX';
    case 'application/zip':
      return 'ZIP';
    case 'application/vnd.rar':
      return 'RAR';
    default:
      return 'Archivo';
  }
}

IconData _documentIcon(String? mimeType) {
  switch ((mimeType ?? '').toLowerCase()) {
    case 'application/pdf':
      return Icons.picture_as_pdf_outlined;
    case 'text/plain':
    case 'text/csv':
      return Icons.description_outlined;
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return Icons.article_outlined;
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return Icons.table_chart_outlined;
    default:
      return Icons.insert_drive_file_outlined;
  }
}

String? _resolveSelectedContactPhoneNumber(BotCenterController controller) {
  final fromConversation =
      controller.selectedConversationOrNull?.phoneNumber.trim();
  if (fromConversation != null &&
      fromConversation.isNotEmpty &&
      fromConversation != '-') {
    return fromConversation;
  }

  final fromContact = controller.selectedContact.phoneNumber.trim();
  if (fromContact.isNotEmpty && fromContact != '-') {
    return fromContact;
  }

  return null;
}

String _resolveSelectedContactDisplayName(
  BotCenterController controller,
  BotConversation conversation,
) {
  final fromContact = controller.selectedContact.name.trim();
  if (fromContact.isNotEmpty &&
      fromContact != '-' &&
      fromContact != 'No disponible') {
    return fromContact;
  }

  final fromConversation = conversation.contactName.trim();
  if (fromConversation.isNotEmpty) {
    return fromConversation;
  }

  return 'Contacto';
}

Future<void> _copyContactSummary(
  BuildContext context, {
  required String contactName,
  required String? contactPhoneNumber,
}) async {
  final sanitizedName =
      contactName.trim().isEmpty ? 'Contacto' : contactName.trim();
  final sanitizedPhone =
      contactPhoneNumber == null || contactPhoneNumber.trim().isEmpty
          ? 'No disponible'
          : contactPhoneNumber.trim();

  await Clipboard.setData(
    ClipboardData(
      text: 'Nombre: $sanitizedName\nTeléfono: $sanitizedPhone',
    ),
  );

  if (!context.mounted) {
    return;
  }

  ScaffoldMessenger.maybeOf(context)?.showSnackBar(
    const SnackBar(
      content: Text('Nombre y teléfono copiados'),
      duration: Duration(seconds: 2),
    ),
  );
}

String _senderLabel(
  BotMessageAuthor author, {
  String? contactPhoneNumber,
}) {
  switch (author) {
    case BotMessageAuthor.contact:
      return contactPhoneNumber == null
          ? 'Cliente'
          : 'Cliente • $contactPhoneNumber';
    case BotMessageAuthor.bot:
      return 'Bot';
    case BotMessageAuthor.operator:
      return 'Operador';
    case BotMessageAuthor.system:
      return 'Sistema';
  }
}
