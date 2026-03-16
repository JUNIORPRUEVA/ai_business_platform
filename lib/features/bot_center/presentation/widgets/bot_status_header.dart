import 'package:flutter/material.dart';

import '../../domain/entities/bot_service_status.dart';
import '../controllers/bot_center_controller.dart';

class BotStatusHeader extends StatelessWidget {
  const BotStatusHeader({
    required this.controller,
    required this.onOpenSettings,
    super.key,
  });

  final BotCenterController controller;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        gradient: const LinearGradient(
          colors: [Color(0xFFFDFEFF), Color(0xFFF2F7FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120F172A),
            blurRadius: 30,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('FULLPOS Bot Center',
                          style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 8),
                      Text(
                        'Superficie de mando empresarial para conversaciones, memoria, prompts, herramientas y salud operativa.',
                        style: theme.textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  OutlinedButton.icon(
                    onPressed: controller.isRefreshing
                        ? null
                        : controller.refreshModule,
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(
                        controller.isRefreshing ? 'Actualizando...' : 'Actualizar'),
                  ),
                  IconButton.outlined(
                    onPressed: onOpenSettings,
                    icon: const Icon(Icons.settings_outlined),
                    tooltip: 'Abrir centro de configuración',
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: controller.serviceStatuses
                .take(3)
                .map(_HeaderStatusChip.new)
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _HeaderStatusChip extends StatelessWidget {
  const _HeaderStatusChip(this.status);

  final BotServiceStatus status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final indicatorColor =
        status.isHealthy ? const Color(0xFF12B76A) : const Color(0xFFF79009);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration:
                BoxDecoration(color: indicatorColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(status.title, style: theme.textTheme.labelLarge),
              Text(status.value, style: theme.textTheme.bodyMedium),
            ],
          ),
        ],
      ),
    );
  }
}
