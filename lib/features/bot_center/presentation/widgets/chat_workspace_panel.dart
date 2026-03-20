import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../domain/entities/bot_conversation.dart';
import '../../domain/entities/bot_message.dart';
import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

class ChatWorkspacePanel extends StatelessWidget {
  const ChatWorkspacePanel({
    required this.controller,
    super.key,
  });

  final BotCenterController controller;

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
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: theme.colorScheme.outlineVariant),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0D0F172A),
                  blurRadius: 24,
                  offset: Offset(0, 10),
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
                    padding:
                        const EdgeInsets.fromLTRB(10, 14, 10, 14 + 72 + 18),
                    child: _MessageViewport(controller: controller),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 14,
                  child: _FloatingComposer(controller: controller),
                ),
                if (controller.hasConversationSelection)
                  Positioned(
                    right: 20,
                    bottom: 102,
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
  });

  final BotCenterController controller;
  final BotConversation conversation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 68,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFFE2E8F0),
            child: Text(
              conversation.contactName.characters.first,
              style: theme.textTheme.labelLarge?.copyWith(
                color: const Color(0xFF0F172A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 14),
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
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Activo • ${conversation.phoneNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 12.5,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
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

  @override
  void dispose() {
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

    _scheduleScrollToBottomIfNeeded(controller.selectedMessages.length);

    return Scrollbar(
      controller: _scrollController,
      child: ListView.separated(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
        itemCount: controller.selectedMessages.length,
        separatorBuilder: (_, __) => const SizedBox(height: 16),
        itemBuilder: (context, index) {
          final message = controller.selectedMessages[index];
          return _MessageBubble(controller: controller, message: message);
        },
      ),
    );
  }

  void _scheduleScrollToBottomIfNeeded(int nextMessageCount) {
    if (nextMessageCount == _lastRenderedMessageCount) {
      return;
    }

    _lastRenderedMessageCount = nextMessageCount;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) {
        return;
      }

      final position = _scrollController.position.maxScrollExtent;
      _scrollController.animateTo(
        position,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    });
  }
}

class _FloatingComposer extends StatelessWidget {
  const _FloatingComposer({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canSend = controller.hasConversationSelection &&
        controller.hasDraftMessage &&
        !controller.isSendingMessage &&
        !controller.isProcessingWithAi;

    void sendMessage() {
      if (!canSend) {
        return;
      }
      unawaited(controller.sendDraftMessage());
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x160F172A),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Adjuntar',
            onPressed: controller.hasConversationSelection &&
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
            child: CallbackShortcuts(
              bindings: <ShortcutActivator, VoidCallback>{
                const SingleActivator(LogicalKeyboardKey.enter): sendMessage,
                const SingleActivator(LogicalKeyboardKey.numpadEnter):
                    sendMessage,
              },
              child: TextField(
                controller: controller.messageComposerController,
                decoration: InputDecoration(
                  hintText: 'Escribir mensaje...',
                  hintStyle: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    color: const Color(0xFF94A3B8),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => sendMessage(),
                minLines: 1,
                maxLines: 4,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 14,
                  color: const Color(0xFF0F172A),
                  height: 1.35,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 44,
            child: FilledButton(
              onPressed: canSend ? sendMessage : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(horizontal: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                controller.isSendingMessage ? 'Enviando...' : 'Enviar',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
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

    return LayoutBuilder(
      builder: (context, constraints) {
        final mediaHeavy = message.hasMedia;
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
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    _senderLabel(message.author),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 11.5,
                          color: metaColor,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: EdgeInsets.all(message.hasMedia ? 10 : 15),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: BorderRadius.circular(22),
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
                      if (message.hasMedia)
                        _MessageMedia(
                          controller: controller,
                          message: message,
                        ),
                      if (displayText.trim().isNotEmpty) ...[
                        if (message.hasMedia) const SizedBox(height: 10),
                        Text(
                          displayText,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontSize: 14,
                                    color: textColor,
                                    height: 1.45,
                                  ),
                        ),
                      ],
                      const SizedBox(height: 10),
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
                                      fontSize: 10.5,
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
    final previewUrl = _resolvePreviewUrl(message);
    final hasVisual = message.localPreviewBytes != null || previewUrl != null;
    final mediaLabel = message.fileName?.trim().isNotEmpty == true
        ? message.fileName!
        : (message.isImage ? 'Imagen' : 'Video');

    return GestureDetector(
      onTap: () async {
        if (message.isImage &&
            (message.localPreviewBytes != null || previewUrl != null)) {
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
        } else if (message.isVideo && message.mediaUrl != null) {
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
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: double.infinity,
              constraints: BoxConstraints(
                minHeight: message.isVideo ? 220 : 200,
                maxHeight: message.isVideo ? 340 : 420,
              ),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x1F020617),
                    blurRadius: 24,
                    offset: Offset(0, 12),
                  ),
                ],
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
                          Color(0xFF111827),
                          Color(0xFF020617),
                        ],
                      ),
                    ),
                    child: _buildMediaVisual(
                      message: message,
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
                            Colors.black.withValues(alpha: 0.08),
                            Colors.black.withValues(alpha: 0.40),
                          ],
                          stops: const [0.45, 0.72, 1],
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
                        if (message.isImage)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.18),
                              ),
                            ),
                            child: const Text(
                              'Foto',
                              style: TextStyle(
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
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.52),
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
                  size: 38,
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
  }

  Widget _buildMediaVisual({
    required BotMessage message,
    required String? previewUrl,
    required bool hasVisual,
  }) {
    if (message.localPreviewBytes != null) {
      return Center(
        child: Image.memory(
          message.localPreviewBytes!,
          fit: message.isImage ? BoxFit.contain : BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          filterQuality: FilterQuality.high,
        ),
      );
    }

    if (previewUrl != null) {
      return CachedNetworkImage(
        imageUrl: previewUrl,
        fit: message.isImage ? BoxFit.contain : BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (_, __) => const _MediaLoadingPlaceholder(),
        errorWidget: (_, __, ___) => const _MediaFallbackState(
          icon: Icons.broken_image_outlined,
          label: 'No se pudo cargar la vista previa',
        ),
      );
    }

    return _MediaFallbackState(
      icon: hasVisual ? Icons.image_search_rounded : Icons.perm_media_outlined,
      label: message.state == BotMessageState.queued
          ? 'Preparando vista previa...'
          : 'Vista previa no disponible todavía',
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

String? _resolvePreviewUrl(BotMessage message) {
  final thumbnail = message.thumbnailUrl?.trim();
  if (thumbnail != null && thumbnail.isNotEmpty) {
    return thumbnail;
  }

  final media = message.mediaUrl?.trim();
  if (media != null && media.isNotEmpty) {
    return media;
  }

  return null;
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
    return Dialog.fullscreen(
      backgroundColor: const Color(0xFF020617),
      child: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              child: message.localPreviewBytes != null
                  ? Image.memory(
                      message.localPreviewBytes!,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                    )
                  : (_resolvePreviewUrl(message) != null
                      ? CachedNetworkImage(
                          imageUrl: _resolvePreviewUrl(message)!,
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
      color: const Color(0xFF0F172A),
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

  @override
  void initState() {
    super.initState();
    _player = Player();
    _videoController = VideoController(_player);
    unawaited(_openVideo());
  }

  Future<void> _openVideo() async {
    if (widget.message.localFileBytes != null) {
      final directory =
          await Directory.systemTemp.createTemp('bot-center-video-');
      final extension = _fileExtension(widget.message.fileName ?? 'video.mp4');
      final file = File('${directory.path}\\video.$extension');
      await file.writeAsBytes(widget.message.localFileBytes!, flush: true);
      _tempFile = file;
      await _player.open(Media(file.path));
      return;
    }

    final remoteUrl = widget.message.mediaUrl;
    if (remoteUrl != null && remoteUrl.trim().isNotEmpty) {
      await _player.open(Media(remoteUrl));
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
            child: AspectRatio(
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
