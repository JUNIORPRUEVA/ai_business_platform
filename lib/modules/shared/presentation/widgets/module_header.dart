import 'package:flutter/material.dart';

class ModuleHeader extends StatelessWidget {
  const ModuleHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      runSpacing: 16,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.68),
                  height: 1.55,
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
