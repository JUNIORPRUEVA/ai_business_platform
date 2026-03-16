import 'package:flutter/material.dart';

import '../../../bot_center/presentation/screens/bot_center_screen.dart';
import '../../../bot_configuration_center/presentation/screens/bot_configuration_center_screen.dart';

class EnterpriseBotWorkspaceScreen extends StatefulWidget {
  const EnterpriseBotWorkspaceScreen({super.key});

  @override
  State<EnterpriseBotWorkspaceScreen> createState() =>
      _EnterpriseBotWorkspaceScreenState();
}

class _EnterpriseBotWorkspaceScreenState
    extends State<EnterpriseBotWorkspaceScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 900;

    return Stack(
      children: [
        IndexedStack(
          index: _selectedIndex,
          children: [
            BotCenterScreen(
              onOpenSettings: () {
                if (_selectedIndex == 1) {
                  return;
                }

                setState(() {
                  _selectedIndex = 1;
                });
              },
            ),
            BotConfigurationCenterScreen(
              onBackToBotCenter: () {
                if (_selectedIndex == 0) {
                  return;
                }

                setState(() {
                  _selectedIndex = 0;
                });
              },
            ),
          ],
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: SafeArea(
            top: false,
            child: Align(
              alignment: Alignment.bottomCenter,
              child: _WorkspaceSwitcher(
                isCompact: isCompact,
                selectedIndex: _selectedIndex,
                onSelect: (index) {
                  if (_selectedIndex == index) {
                    return;
                  }

                  setState(() {
                    _selectedIndex = index;
                  });
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _WorkspaceSwitcher extends StatelessWidget {
  const _WorkspaceSwitcher({
    required this.isCompact,
    required this.selectedIndex,
    required this.onSelect,
  });

  final bool isCompact;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxWidth: isCompact ? 520 : 580),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [
          BoxShadow(
            color: Color(0x180F172A),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Material(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(26),
        clipBehavior: Clip.antiAlias,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0xFFD8E3F2)),
          ),
          child: Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              _WorkspaceChip(
                title: 'Bot Center',
                subtitle: 'Conversations, memory, prompt, and status.',
                icon: Icons.hub_outlined,
                isSelected: selectedIndex == 0,
                onTap: () => onSelect(0),
              ),
              _WorkspaceChip(
                title: 'Configuration Center',
                subtitle: 'Runtime policies, integrations, and orchestrator setup.',
                icon: Icons.tune_rounded,
                isSelected: selectedIndex == 1,
                onTap: () => onSelect(1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WorkspaceChip extends StatelessWidget {
  const _WorkspaceChip({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final backgroundColor =
        isSelected ? const Color(0xFF165DFF) : const Color(0xFFF8FAFC);
    final borderColor =
        isSelected ? const Color(0xFF165DFF) : const Color(0xFFD8E3F2);
    final titleColor = isSelected ? Colors.white : const Color(0xFF0F172A);
    final subtitleColor =
        isSelected ? const Color(0xFFDDE7FF) : const Color(0xFF526277);
    final iconColor = isSelected ? Colors.white : const Color(0xFF165DFF);

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 250,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.14)
                    : const Color(0xFFE8F0FF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: titleColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: subtitleColor,
                      fontSize: 12.5,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
