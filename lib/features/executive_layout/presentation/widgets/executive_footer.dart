import 'package:flutter/material.dart';

class ExecutiveFooter extends StatelessWidget {
  const ExecutiveFooter({
    super.key,
    this.height = 50,
  });

  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: theme.colorScheme.outlineVariant.withValues(alpha: 0.55),
            ),
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isCompact = constraints.maxWidth < 1050;

            return Padding(
              padding: EdgeInsets.symmetric(horizontal: isCompact ? 14 : 20),
              child: Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            '© 2026 FULLTECH Systems',
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                        if (!isCompact) ...[
                          const SizedBox(width: 12),
                          Flexible(
                            child: Text(
                              'Plataforma de gestión empresarial',
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface.withValues(alpha: 0.60),
                                fontSize: 12.5,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  _StatusPill(
                    label: isCompact ? 'Operativo' : 'Sistema: operativo',
                    dotColor: const Color(0xFF22C55E),
                    compact: isCompact,
                  ),
                  SizedBox(width: isCompact ? 8 : 10),
                  _StatusPill(
                    label: 'v0.1.0',
                    dotColor: theme.colorScheme.primary,
                    showDot: false,
                    compact: isCompact,
                  ),
                  SizedBox(width: isCompact ? 8 : 10),
                  _StatusPill(
                    label: isCompact ? 'En línea' : 'Conexión: en línea',
                    dotColor: const Color(0xFF38BDF8),
                    compact: isCompact,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StatusPill extends StatefulWidget {
  const _StatusPill({
    required this.label,
    required this.dotColor,
    this.showDot = true,
    this.compact = false,
  });

  final String label;
  final Color dotColor;
  final bool showDot;
  final bool compact;

  @override
  State<_StatusPill> createState() => _StatusPillState();
}

class _StatusPillState extends State<_StatusPill> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final horizontalPadding = widget.compact ? 8.0 : 10.0;
    final verticalPadding = widget.compact ? 6.0 : 7.0;
    final fontSize = widget.compact ? 11.5 : 12.0;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: horizontalPadding,
          vertical: verticalPadding,
        ),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface.withValues(alpha: _isHovered ? 0.16 : 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.55),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.showDot) ...[
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: widget.dotColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: widget.dotColor.withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
            ],
            Text(
              widget.label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.76),
                fontSize: fontSize,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
