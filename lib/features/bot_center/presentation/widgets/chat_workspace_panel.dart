import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
        _ConversationHeader(conversation: conversation),
        const SizedBox(height: 12),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Padding(
                    padding:
                        const EdgeInsets.fromLTRB(16, 16, 16, 16 + 56 + 16),
                    child: _MessageViewport(controller: controller),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: _FloatingComposer(controller: controller),
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
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
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
  const _ConversationHeader({required this.conversation});

  final BotConversation conversation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
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
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Activo • ${conversation.phoneNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 12,
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
          IconButton(
            tooltip: 'Opciones',
            onPressed: () {},
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

    return Scrollbar(
      controller: _scrollController,
      child: ListView.separated(
        controller: _scrollController,
        itemCount: controller.selectedMessages.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final message = controller.selectedMessages[index];
          return _MessageBubble(message: message);
        },
      ),
    );
  }
}

class _FloatingComposer extends StatelessWidget {
  const _FloatingComposer({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canSend =
        controller.hasConversationSelection && !controller.isSendingMessage;
    void sendMessage() {
      if (!canSend) {
        return;
      }
      unawaited(controller.sendDraftMessage());
    }

    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Adjuntar',
            onPressed: () {},
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
                    fontSize: 13,
                    color: const Color(0xFF94A3B8),
                  ),
                  border: InputBorder.none,
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => sendMessage(),
                minLines: 1,
                maxLines: 3,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 40,
            child: FilledButton(
              onPressed: canSend ? sendMessage : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
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
  const _MessageBubble({required this.message});

  final BotMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.author == BotMessageAuthor.contact;
    final bubbleColor = isUser ? const Color(0xFF2563EB) : Colors.white;
    final textColor = isUser ? Colors.white : const Color(0xFF0F172A);
    final metaColor =
        isUser ? Colors.white.withValues(alpha: 0.78) : const Color(0xFF64748B);
    final alignment = isUser ? Alignment.centerRight : Alignment.centerLeft;

    return LayoutBuilder(
      builder: (context, constraints) {
        return Align(
          alignment: alignment,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: constraints.maxWidth * 0.70,
            ),
            child: Column(
              crossAxisAlignment:
                  isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '${_senderLabel(message.author)} • ${formatConversationTimestamp(message.timestamp)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: metaColor,
                        ),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(message.body,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontSize: 13,
                            color: textColor,
                            height: 1.35,
                          )),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
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
