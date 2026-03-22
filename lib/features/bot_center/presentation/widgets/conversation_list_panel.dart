import 'package:cached_network_image/cached_network_image.dart';

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
        padding: const EdgeInsets.fromLTRB(0, 4, 0, 12),
        itemBuilder: (context, index) {
          final conversation = widget.conversations[index];
          final isSelected = conversation.id == widget.selectedConversationId;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
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

class _ChatCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasUnread = conversation.unreadCount > 0;
    final timeColor =
        hasUnread ? const Color(0xFF00A884) : const Color(0xFF667781);
    final cardColor =
        isSelected ? const Color(0xFFE7F1EE) : const Color(0xFFFFFFFF);
    final borderColor =
        isSelected ? const Color(0xFFB6D8CE) : const Color(0xFFE9EDEF);

    final titleStyle = theme.textTheme.bodyMedium?.copyWith(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      color: const Color(0xFF111B21),
    );

    final previewStyle = theme.textTheme.bodyMedium?.copyWith(
      fontSize: 12.6,
      height: 1.25,
      color: const Color(0xFF667781),
    );

    final timeStyle = theme.textTheme.bodySmall?.copyWith(
      fontSize: 11,
      color: timeColor,
      fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
    );
    final previewData =
        _resolveConversationPreview(conversation.lastMessagePreview);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        hoverColor: const Color(0xFFF7F8F8),
        splashColor: const Color(0x1200A884),
        highlightColor: const Color(0x0F00A884),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOutCubic,
          height: 84,
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor),
            boxShadow: [
              if (isSelected)
                const BoxShadow(
                  color: Color(0x1200A884),
                  blurRadius: 12,
                  offset: Offset(0, 4),
                )
              else
                const BoxShadow(
                  color: Color(0x060F172A),
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Stack(
                children: [
                  _ConversationAvatar(conversation: conversation),
                  if (hasUnread)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 11,
                        height: 11,
                        decoration: BoxDecoration(
                          color: const Color(0xFF00A884),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            conversation.contactName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: titleStyle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          formatConversationTimestamp(conversation.lastUpdated),
                          style: timeStyle,
                        ),
                        if (isLoading && isSelected) ...[
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
                    Row(
                      children: [
                        if (previewData.icon != null) ...[
                          Icon(
                            previewData.icon,
                            size: 14,
                            color: const Color(0xFF667781),
                          ),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            previewData.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: previewStyle,
                          ),
                        ),
                        if (hasUnread) ...[
                          const SizedBox(width: 10),
                          Container(
                            constraints: const BoxConstraints(minWidth: 20),
                            height: 20,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(
                              color: Color(0xFF00A884),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              conversation.unreadCount > 99
                                  ? '99+'
                                  : '${conversation.unreadCount}',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 10.5,
                              ),
                            ),
                          ),
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
  }
}

class _ConversationAvatar extends StatelessWidget {
  const _ConversationAvatar({required this.conversation});

  final BotConversation conversation;

  @override
  Widget build(BuildContext context) {
    final imageUrl = _normalizedProfileImageUrl(conversation.profilePictureUrl);

    return CircleAvatar(
      radius: 21,
      backgroundColor: const Color(0xFFDDE6EA),
      foregroundImage:
          imageUrl == null ? null : CachedNetworkImageProvider(imageUrl),
      child: Text(
        conversation.contactName.characters.first,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: const Color(0xFF111B21),
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

String? _normalizedProfileImageUrl(String? candidate) {
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

class _ConversationPreviewData {
  const _ConversationPreviewData({required this.label, this.icon});

  final String label;
  final IconData? icon;
}

_ConversationPreviewData _resolveConversationPreview(String preview) {
  final normalized = preview.trim();
  final lowercase = normalized.toLowerCase();

  if (lowercase.contains('nota de voz') ||
      lowercase.contains('audio') ||
      lowercase.contains('voice')) {
    return _ConversationPreviewData(
      label: normalized.isEmpty ? 'Nota de voz' : normalized,
      icon: Icons.mic_rounded,
    );
  }

  if (lowercase.contains('imagen') ||
      lowercase.contains('foto') ||
      lowercase.contains('image')) {
    return _ConversationPreviewData(
      label: normalized.isEmpty ? 'Foto' : normalized,
      icon: Icons.photo_camera_outlined,
    );
  }

  if (lowercase.contains('video')) {
    return _ConversationPreviewData(
      label: normalized.isEmpty ? 'Video' : normalized,
      icon: Icons.videocam_outlined,
    );
  }

  if (lowercase.contains('documento') ||
      lowercase.contains('archivo') ||
      lowercase.contains('pdf')) {
    return _ConversationPreviewData(
      label: normalized.isEmpty ? 'Documento' : normalized,
      icon: Icons.insert_drive_file_outlined,
    );
  }

  return _ConversationPreviewData(label: normalized);
}
