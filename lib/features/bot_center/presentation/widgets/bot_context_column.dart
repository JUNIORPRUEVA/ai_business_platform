import 'package:flutter/material.dart';

import '../../domain/entities/bot_activity_log.dart';
import '../../domain/entities/bot_contact_context.dart';
import '../../domain/entities/bot_memory_item.dart';
import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

class BotContextColumn extends StatelessWidget {
  const BotContextColumn({
    required this.controller,
    required this.onCollapse,
    super.key,
  });

  final BotCenterController controller;
  final VoidCallback onCollapse;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: SizedBox(
              height: 44,
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.account_tree_outlined,
                        size: 18, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Contexto',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Ocultar contexto',
                    onPressed: onCollapse,
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Scrollbar(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ContextBlock(
                        title: 'Contacto',
                        child: _ContactBlock(contact: controller.selectedContact),
                      ),
                      const SizedBox(height: 10),
                      _ContextBlock(
                        title: 'Memoria',
                        child: _MemoryBlock(controller: controller),
                      ),
                      const SizedBox(height: 10),
                      _ContextBlock(
                        title: 'Historial',
                        child: _HistoryBlock(logs: controller.visibleLogs),
                      ),
                      const SizedBox(height: 10),
                      _ContextBlock(
                        title: 'Etiquetas',
                        child: _TagsBlock(tags: controller.selectedContact.tags),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContextBlock extends StatelessWidget {
  const _ContextBlock({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _ContactBlock extends StatelessWidget {
  const _ContactBlock({required this.contact});

  final BotContactContext contact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (contact.name == 'No disponible' && contact.phoneNumber == 'No disponible') {
      return Text(
        'Selecciona un chat para ver el perfil del contacto.',
        style: theme.textTheme.bodyMedium?.copyWith(
          fontSize: 13,
          color: const Color(0xFF475569),
        ),
      );
    }

    Widget row(String label, String value) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 84,
              child: Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: 11,
                  color: const Color(0xFF64748B),
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        row('Nombre', contact.name),
        row('Teléfono', contact.phoneNumber),
        if (contact.role != 'No disponible') row('Rol', contact.role),
        if (contact.businessType != 'No disponible') row('Negocio', contact.businessType),
        if (contact.city != 'No disponible') row('Ciudad', contact.city),
      ],
    );
  }
}

class _TagsBlock extends StatelessWidget {
  const _TagsBlock({required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (tags.isEmpty) {
      return Text(
        'Sin etiquetas.',
        style: theme.textTheme.bodyMedium?.copyWith(
          fontSize: 13,
          color: const Color(0xFF475569),
        ),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: tags
          .map(
            (tag) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Text(
                tag,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 12,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _MemoryBlock extends StatelessWidget {
  const _MemoryBlock({required this.controller});

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final sections = BotMemoryType.values
        .map((type) => (type, controller.memoryByType(type)))
        .where((entry) => entry.$2.isNotEmpty)
        .toList(growable: false);

    if (sections.isEmpty) {
      return Text(
        'Sin memoria disponible para esta conversación.',
        style: theme.textTheme.bodyMedium?.copyWith(
          fontSize: 13,
          color: const Color(0xFF475569),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in sections) ...[
          Text(
            entry.$1.label,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF334155),
            ),
          ),
          const SizedBox(height: 8),
          for (final item in entry.$2.take(3)) ...[
            _MemoryItemRow(item: item),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _MemoryItemRow extends StatelessWidget {
  const _MemoryItemRow({required this.item});

  final BotMemoryItem item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatRelativeTimestamp(item.updatedAt),
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: 11,
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.content,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontSize: 13,
              color: const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryBlock extends StatelessWidget {
  const _HistoryBlock({required this.logs});

  final List<BotActivityLog> logs;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (logs.isEmpty) {
      return Text(
        'Sin eventos recientes.',
        style: theme.textTheme.bodyMedium?.copyWith(
          fontSize: 13,
          color: const Color(0xFF475569),
        ),
      );
    }

    final recent = logs.take(8).toList(growable: false);

    return Column(
      children: [
        for (final log in recent) ...[
          _LogRow(log: log),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _LogRow extends StatelessWidget {
  const _LogRow({required this.log});

  final BotActivityLog log;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = _severityPalette(log.severity);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: palette.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(palette.icon, color: palette.foreground, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        log.eventType,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      formatRelativeTimestamp(log.timestamp),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  log.summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 13,
                    color: const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

({Color background, Color foreground, IconData icon}) _severityPalette(
    BotLogSeverity severity) {
  switch (severity) {
    case BotLogSeverity.info:
      return (
        background: const Color(0xFFEFF4FF),
        foreground: const Color(0xFF2563EB),
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
