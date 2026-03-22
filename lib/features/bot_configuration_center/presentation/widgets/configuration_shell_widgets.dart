import 'package:flutter/material.dart';

class ConfigurationShellCard extends StatelessWidget {
  const ConfigurationShellCard({
    required this.title,
    required this.child,
    super.key,
    this.subtitle,
    this.trailing,
    this.expandContent = false,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;
  final bool expandContent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.88),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120F172A),
            blurRadius: 26,
            offset: Offset(0, 16),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleLarge),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(subtitle!, style: theme.textTheme.bodyMedium),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 18),
          if (expandContent) Expanded(child: child) else child,
        ],
      ),
    );
  }
}

class ConfigurationBanner extends StatelessWidget {
  const ConfigurationBanner({
    required this.message,
    required this.isError,
    required this.onDismiss,
    super.key,
  });

  final String message;
  final bool isError;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final background =
        isError ? const Color(0xFFFEECEC) : const Color(0xFFEAFBF3);
    final foreground =
        isError ? const Color(0xFFB42318) : const Color(0xFF067647);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: foreground.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(
            isError
                ? Icons.error_outline_rounded
                : Icons.check_circle_outline_rounded,
            color: foreground,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: foreground),
            ),
          ),
          IconButton(
            onPressed: onDismiss,
            icon: const Icon(Icons.close_rounded),
            color: foreground,
          ),
        ],
      ),
    );
  }
}

class ConfigurationSummaryTile extends StatelessWidget {
  const ConfigurationSummaryTile({
    required this.label,
    required this.value,
    required this.description,
    required this.accent,
    super.key,
  });

  final String label;
  final String value;
  final String description;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.34),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.labelLarge),
          const SizedBox(height: 10),
          Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(color: accent),
          ),
          const SizedBox(height: 8),
          Text(description, style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class SectionActionBar extends StatelessWidget {
  const SectionActionBar({
    required this.onSave,
    required this.isSaving,
    super.key,
    this.onTestConnection,
    this.isTesting = false,
  });

  final VoidCallback onSave;
  final bool isSaving;
  final VoidCallback? onTestConnection;
  final bool isTesting;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.end,
      spacing: 12,
      runSpacing: 12,
      children: [
        if (onTestConnection != null)
          OutlinedButton.icon(
            onPressed: isTesting ? null : onTestConnection,
            icon: const Icon(Icons.radar_outlined),
            label: Text(isTesting ? 'Probando...' : 'Probar conexión'),
          ),
        FilledButton.icon(
          onPressed: isSaving ? null : onSave,
          icon: const Icon(Icons.save_outlined),
          label: Text(isSaving ? 'Guardando...' : 'Guardar cambios'),
        ),
      ],
    );
  }
}

class SettingSwitchTile extends StatelessWidget {
  const SettingSwitchTile({
    required this.label,
    required this.description,
    required this.value,
    required this.onChanged,
    super.key,
  });

  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(description, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

class LabeledDropdownField extends StatelessWidget {
  const LabeledDropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    super.key,
  });

  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            DropdownMenu<String>(
              width: constraints.maxWidth,
              initialSelection: value,
              onSelected: onChanged,
              dropdownMenuEntries: items
                  .map(
                    (item) =>
                        DropdownMenuEntry<String>(value: item, label: item),
                  )
                  .toList(growable: false),
            ),
          ],
        );
      },
    );
  }
}

class LabeledTextField extends StatelessWidget {
  const LabeledTextField({
    required this.label,
    required this.controller,
    super.key,
    this.hintText,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController controller;
  final String? hintText;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          maxLines: maxLines,
          decoration: InputDecoration(hintText: hintText),
        ),
      ],
    );
  }
}
