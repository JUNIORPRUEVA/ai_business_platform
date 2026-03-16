import 'package:flutter/material.dart';

import '../controllers/bot_center_controller.dart';
import 'conversation_list_panel.dart';

class BotSidebar extends StatelessWidget {
  const BotSidebar({
    required this.controller,
    super.key,
  });

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final filteredConversations = controller.filteredConversations;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Row(
            children: [
              Icon(Icons.search_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.55), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: controller.updateSearchQuery,
                  decoration: const InputDecoration(
                    hintText: 'Buscar chat',
                    border: InputBorder.none,
                    isCollapsed: true,
                  ),
                  style: theme.textTheme.bodyMedium?.copyWith(fontSize: 13),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: controller.isInitialLoading && !controller.hasLoaded
              ? const Center(child: CircularProgressIndicator())
              : ConversationListPanel(
                  conversations: filteredConversations,
                  selectedConversationId: controller.selectedConversationId,
                  onSelectConversation: controller.selectConversation,
                  isLoading: controller.isConversationLoading,
                ),
        ),
      ],
    );
  }
}
