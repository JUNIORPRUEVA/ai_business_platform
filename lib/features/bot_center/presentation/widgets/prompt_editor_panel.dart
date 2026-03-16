import 'package:flutter/material.dart';

import '../controllers/bot_center_controller.dart';
import '../utils/bot_center_formatters.dart';

class PromptEditorPanel extends StatelessWidget {
  const PromptEditorPanel({
    required this.controller,
    super.key,
  });

  final BotCenterController controller;

  @override
  Widget build(BuildContext context) {
    final prompt = controller.promptConfig;

    return ListView(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(18),
            border:
                Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(prompt.title,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(prompt.description,
                  style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 8),
              Text(
                'Última actualización: ${formatRelativeTimestamp(prompt.lastUpdated)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: controller.promptEditorController,
          onChanged: controller.updatePromptDraft,
          minLines: 14,
          maxLines: 20,
          decoration: const InputDecoration(
            hintText: 'Vista previa del contenido del prompt',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed:
                controller.isSavingPrompt ? null : controller.savePromptDraft,
            icon: const Icon(Icons.save_outlined),
            label:
                Text(controller.isSavingPrompt ? 'Guardando...' : 'Guardar prompt'),
          ),
        ),
      ],
    );
  }
}
