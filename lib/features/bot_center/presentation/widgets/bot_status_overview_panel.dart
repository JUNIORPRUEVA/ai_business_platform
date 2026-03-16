import 'package:flutter/material.dart';

import '../../domain/entities/bot_service_status.dart';

class BotStatusOverviewPanel extends StatelessWidget {
  const BotStatusOverviewPanel({
    required this.statuses,
    super.key,
  });

  final List<BotServiceStatus> statuses;

  @override
  Widget build(BuildContext context) {
    if (statuses.isEmpty) {
      return Center(
        child: Text(
          'No hay tarjetas de estado disponibles en este momento.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.separated(
      itemCount: statuses.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final status = statuses[index];
        final accent = status.isHealthy
            ? const Color(0xFF12B76A)
            : const Color(0xFFF79009);

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
                  Container(
                    width: 10,
                    height: 10,
                    decoration:
                        BoxDecoration(color: accent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(status.title,
                          style: Theme.of(context).textTheme.titleMedium)),
                ],
              ),
              const SizedBox(height: 10),
              Text(status.value,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(color: accent)),
              const SizedBox(height: 8),
              Text(status.description,
                  style: Theme.of(context).textTheme.bodyLarge),
            ],
          ),
        );
      },
    );
  }
}
