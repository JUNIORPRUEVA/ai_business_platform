import 'package:flutter/material.dart';

import '../../domain/entities/bot_memory_item.dart';
import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

class BotMemoryPanel extends StatelessWidget {
  const BotMemoryPanel({
    required this.controller,
    super.key,
  });

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: BotMemoryType.values.map((type) {
        final items = controller.memoryByType(type);
        return Padding(
          padding: const EdgeInsets.only(bottom: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(type.label, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              if (items.isEmpty)
                _MemoryPlaceholder(type: type)
              else
                ...items.map(
                  (item) => _MemoryCard(item: item),
                ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _MemoryCard extends StatelessWidget {
  const _MemoryCard({required this.item});

  final BotMemoryItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: Text(item.title,
                      style: Theme.of(context).textTheme.titleMedium)),
              Text(formatRelativeTimestamp(item.updatedAt),
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 10),
          Text(item.content, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _MemoryPlaceholder extends StatelessWidget {
  const _MemoryPlaceholder({required this.type});

  final BotMemoryType type;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text(
        'Aún no hay memoria de ${type.label.toLowerCase()} para esta conversación.',
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}
