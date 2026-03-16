import 'package:flutter/material.dart';

import '../../domain/entities/bot_configuration_section.dart';

class ConfigurationNavigationPanel extends StatelessWidget {
  const ConfigurationNavigationPanel({
    required this.selectedSection,
    required this.onSelectSection,
    super.key,
  });

  final BotConfigurationSection selectedSection;
  final ValueChanged<BotConfigurationSection> onSelectSection;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120F172A),
            blurRadius: 28,
            offset: Offset(0, 16),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Configuración', style: theme.textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            'Controles empresariales para integraciones, prompts, memoria y seguridad.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          Expanded(
            child: ListView.separated(
              itemCount: BotConfigurationSection.values.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final section = BotConfigurationSection.values[index];
                final isSelected = section == selectedSection;

                return InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => onSelectSection(section),
                  child: Ink(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFEEF4FF)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFFB2CCFF)
                            : theme.colorScheme.outlineVariant,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFFDCE8FF)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            _sectionIcon(section),
                            color: isSelected
                                ? const Color(0xFF165DFF)
                                : const Color(0xFF475569),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(section.label,
                                  style: theme.textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Text(
                                section.subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

IconData _sectionIcon(BotConfigurationSection section) {
  switch (section) {
    case BotConfigurationSection.general:
      return Icons.tune_rounded;
    case BotConfigurationSection.evolutionApi:
      return Icons.hub_outlined;
    case BotConfigurationSection.openAi:
      return Icons.auto_awesome_outlined;
    case BotConfigurationSection.memory:
      return Icons.memory_outlined;
    case BotConfigurationSection.orchestrator:
      return Icons.alt_route_rounded;
    case BotConfigurationSection.prompts:
      return Icons.edit_note_rounded;
    case BotConfigurationSection.tools:
      return Icons.extension_outlined;
    case BotConfigurationSection.security:
      return Icons.verified_user_outlined;
  }
}
