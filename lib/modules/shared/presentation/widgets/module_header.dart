import 'package:flutter/material.dart';

class ModuleHeader extends StatelessWidget {
  const ModuleHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.compact = false,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      runSpacing: compact ? 12 : 16,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: compact ? 680 : 760),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: compact ? 9 : 10,
                  vertical: compact ? 5 : 6,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: theme.colorScheme.primary.withValues(alpha: 0.08),
                  border: Border.all(
                    color: theme.colorScheme.primary.withValues(alpha: 0.14),
                  ),
                ),
                child: Text(
                  'Workspace',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: compact ? 11.5 : null,
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              SizedBox(height: compact ? 10 : 14),
              Text(
                title,
                style: (compact
                        ? theme.textTheme.titleMedium
                        : theme.textTheme.titleLarge)
                    ?.copyWith(
                  fontSize: compact ? 21 : 24,
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              SizedBox(height: compact ? 6 : 8),
              Text(
                subtitle,
                style: (compact
                        ? theme.textTheme.bodySmall
                        : theme.textTheme.bodyMedium)
                    ?.copyWith(
                  fontSize: compact ? 12.5 : null,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.68),
                  height: compact ? 1.42 : 1.55,
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
