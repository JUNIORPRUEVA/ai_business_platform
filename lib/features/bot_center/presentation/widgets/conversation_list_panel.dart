import 'package:flutter/material.dart';

import '../../domain/entities/bot_conversation.dart';
import '../utils/bot_center_formatters.dart';

class ConversationListPanel extends StatefulWidget {
  const ConversationListPanel({
    required this.conversations,
    required this.selectedConversationId,
    required this.onSelectConversation,
    this.isLoading = false,
    super.key,
  });

  final List<BotConversation> conversations;
  final String selectedConversationId;
  final ValueChanged<String> onSelectConversation;
  final bool isLoading;

  @override
  State<ConversationListPanel> createState() => _ConversationListPanelState();
}

class _ConversationListPanelState extends State<ConversationListPanel> {
  late final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.conversations.isEmpty) {
      return Center(
        child: Text(
          'No hay conversaciones que coincidan con los filtros actuales.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return Scrollbar(
      controller: _scrollController,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: widget.conversations.length,
        padding: EdgeInsets.zero,
        itemBuilder: (context, index) {
          final conversation = widget.conversations[index];
          final isSelected = conversation.id == widget.selectedConversationId;
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: _ChatCard(
              conversation: conversation,
              isSelected: isSelected,
              isLoading: widget.isLoading,
              onTap: widget.isLoading
                  ? null
                  : () => widget.onSelectConversation(conversation.id),
            ),
          );
        },
      ),
    );
  }
}

class _ChatCard extends StatefulWidget {
  const _ChatCard({
    required this.conversation,
    required this.isSelected,
    required this.isLoading,
    required this.onTap,
  });

  final BotConversation conversation;
  final bool isSelected;
  final bool isLoading;
  final VoidCallback? onTap;

  @override
  State<_ChatCard> createState() => _ChatCardState();
}

class _ChatCardState extends State<_ChatCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final baseColor = Colors.white;
    final hoverColor = const Color(0xFFF1F5F9);
    final background = _hovered ? hoverColor : baseColor;
    const activeBarColor = Color(0xFF2563EB);

    final titleStyle = theme.textTheme.bodyMedium?.copyWith(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: const Color(0xFF0F172A),
    );

    final previewStyle = theme.textTheme.bodyMedium?.copyWith(
      fontSize: 13,
      height: 1.25,
      color: const Color(0xFF475569),
    );

    final timeStyle = theme.textTheme.bodySmall?.copyWith(
      fontSize: 11,
      color: const Color(0xFF64748B),
    );

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOutCubic,
            height: 72,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(12),
              border: Border(
                left: BorderSide(
                  color: widget.isSelected ? activeBarColor : Colors.transparent,
                  width: 4,
                ),
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: const Color(0xFFE2E8F0),
                  child: Text(
                    widget.conversation.contactName.characters.first,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: const Color(0xFF0F172A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              widget.conversation.contactName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: titleStyle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            formatConversationTimestamp(widget.conversation.lastUpdated),
                            style: timeStyle,
                          ),
                          if (widget.isLoading && widget.isSelected) ...[
                            const SizedBox(width: 8),
                            const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        widget.conversation.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: previewStyle,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
