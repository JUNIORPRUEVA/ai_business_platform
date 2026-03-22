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
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F2F5),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Text(
                'Chats',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF111B21),
                ),
              ),
              const Spacer(),
              _SidebarIconButton(
                icon: Icons.chat_outlined,
                tooltip: 'Nuevo chat',
                onPressed: () {},
              ),
              _SidebarIconButton(
                icon: Icons.tune_rounded,
                tooltip: 'Filtros',
                onPressed: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F2F5),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.search_rounded,
                color: Color(0xFF667781),
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: controller.updateSearchQuery,
                  decoration: const InputDecoration(
                    hintText: 'Buscar un chat o iniciar uno nuevo',
                    border: InputBorder.none,
                    isCollapsed: true,
                  ),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 13,
                    color: const Color(0xFF111B21),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
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

class _SidebarIconButton extends StatelessWidget {
  const _SidebarIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      style: IconButton.styleFrom(
        foregroundColor: const Color(0xFF54656F),
        hoverColor: Colors.white.withValues(alpha: 0.8),
      ),
      icon: Icon(icon, size: 22),
    );
  }
}
