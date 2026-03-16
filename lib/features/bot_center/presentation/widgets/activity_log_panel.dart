import 'package:flutter/material.dart';

import '../../domain/entities/bot_activity_log.dart';
import '../utils/bot_center_formatters.dart';

class ActivityLogPanel extends StatelessWidget {
  const ActivityLogPanel({
    required this.logs,
    super.key,
  });

  final List<BotActivityLog> logs;

  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return Center(
        child: Text(
          'No hay registros disponibles para el alcance actual.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.separated(
      itemCount: logs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final log = logs[index];
        final palette = _severityPalette(log.severity);

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border:
                Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(palette.icon, color: palette.foreground, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                            child: Text(log.eventType,
                                style:
                                    Theme.of(context).textTheme.titleMedium)),
                        Text(
                          formatRelativeTimestamp(log.timestamp),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(log.summary,
                        style: Theme.of(context).textTheme.bodyLarge),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

({Color background, Color foreground, IconData icon}) _severityPalette(
    BotLogSeverity severity) {
  switch (severity) {
    case BotLogSeverity.info:
      return (
        background: const Color(0xFFEFF4FF),
        foreground: const Color(0xFF165DFF),
        icon: Icons.info_outline_rounded,
      );
    case BotLogSeverity.warning:
      return (
        background: const Color(0xFFFFF6E5),
        foreground: const Color(0xFFB54708),
        icon: Icons.warning_amber_rounded,
      );
    case BotLogSeverity.critical:
      return (
        background: const Color(0xFFFEECEC),
        foreground: const Color(0xFFB42318),
        icon: Icons.error_outline_rounded,
      );
  }
}
