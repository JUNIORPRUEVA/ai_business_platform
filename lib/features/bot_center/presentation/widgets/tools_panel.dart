import 'package:flutter/material.dart';

import '../../domain/entities/bot_tool.dart';

class ToolsPanel extends StatelessWidget {
  const ToolsPanel({
    required this.tools,
    super.key,
  });

  final List<BotTool> tools;

  @override
  Widget build(BuildContext context) {
    if (tools.isEmpty) {
      return Center(
        child: Text(
          'No hay herramientas registradas para el runtime del bot.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.separated(
      itemCount: tools.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final tool = tools[index];
        final accent =
            tool.isActive ? const Color(0xFF067647) : const Color(0xFF98A2B3);

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border:
                Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                      child: Text(tool.name,
                          style: Theme.of(context).textTheme.titleMedium)),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      tool.isActive ? 'Activa' : 'Inactiva',
                      style: Theme.of(context)
                          .textTheme
                          .labelLarge
                          ?.copyWith(color: accent),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(tool.description,
                  style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F8FD),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(tool.category,
                    style: Theme.of(context).textTheme.labelLarge),
              ),
            ],
          ),
        );
      },
    );
  }
}
