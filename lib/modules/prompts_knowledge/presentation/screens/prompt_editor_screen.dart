import 'package:flutter/material.dart';
import 'package:flutter_highlight/flutter_highlight.dart';
import 'package:flutter_highlight/themes/monokai-sublime.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class PromptEditorScreen extends StatefulWidget {
  const PromptEditorScreen({super.key});

  @override
  State<PromptEditorScreen> createState() => _PromptEditorScreenState();
}

class _PromptEditorScreenState extends State<PromptEditorScreen> {
  final _controller = TextEditingController(
    text:
        'Eres un asistente de nivel empresarial para una plataforma de mensajería multi-tenant.\n\n- Sé conciso\n- Haz preguntas de aclaración cuando sea necesario\n- Sigue la política de la empresa\n',
  );

  final _testInputController = TextEditingController(
    text: 'Cliente: Hola, ¿tienen iPhone 15 en stock?\n',
  );

  final List<_PromptVersion> _versions = [];
  bool _isTesting = false;
  String? _testOutput;

  @override
  void dispose() {
    _controller.dispose();
    _testInputController.dispose();
    super.dispose();
  }

  Future<void> _runTest() async {
    setState(() {
      _isTesting = true;
      _testOutput = null;
    });

    await Future.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;

    final prompt = _controller.text.trim();
    final safePromptHint = prompt.isEmpty
        ? 'No hay un prompt configurado.'
        : 'Prompt cargado (${prompt.length} caracteres).';

    setState(() {
      _isTesting = false;
      _testOutput =
          '$safePromptHint\n\nVista previa de respuesta (simulada):\nPuedo ayudarte con eso. ¿De qué sucursal estás preguntando y prefieres algún color/almacenamiento en específico?';
    });
  }

  void _saveVersion() {
    final content = _controller.text;
    if (content.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('El prompt está vacío. No hay nada que guardar.')),
      );
      return;
    }

    setState(() {
      _versions.insert(
          0, _PromptVersion(createdAt: DateTime.now(), content: content));
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Prompt guardado como una nueva versión.')),
    );
  }

  Future<void> _openVersions() async {
    final theme = Theme.of(context);

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: theme.colorScheme.surface.withValues(alpha: 0.92),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          title: const Text('Historial de versiones'),
          content: SizedBox(
            width: 640,
            child: _versions.isEmpty
                ? const Text(
                    'Aún no hay versiones. Presiona Guardar para crear una.')
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: _versions.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final v = _versions[index];
                      final preview = v.content.replaceAll('\n', ' ').trim();
                      return ListTile(
                        title: Text(
                          _formatTimestamp(v.createdAt),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        subtitle: Text(
                          preview,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: OutlinedButton(
                          onPressed: () {
                            setState(() => _controller.text = v.content);
                            Navigator.of(dialogContext).pop();
                          },
                          child: const Text('Restaurar'),
                        ),
                      );
                    },
                  ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cerrar'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            title: 'Editor de prompts',
            subtitle:
                'Edita el prompt principal del sistema, el comportamiento del agente y su personalidad. Incluye versionado + prueba simulada.',
            trailing: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: _openVersions,
                  icon: const Icon(Icons.history_rounded),
                  label: const Text('Versiones'),
                ),
                FilledButton.icon(
                  onPressed: _isTesting ? null : _runTest,
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: Text(_isTesting ? 'Probando…' : 'Probar prompt'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final isSingleColumn = constraints.maxWidth < 1080;

              final editor = ExecutiveGlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Prompt principal del sistema',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _controller,
                      minLines: 14,
                      maxLines: 20,
                      decoration: const InputDecoration(
                        hintText: 'Escribe el prompt del sistema…',
                      ),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontFamily: 'Consolas',
                        height: 1.45,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Tip: mantén los prompts aislados por tenant y evita filtrar datos privados entre empresas.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.64),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        FilledButton.icon(
                          onPressed: _saveVersion,
                          icon: const Icon(Icons.save_rounded),
                          label: const Text('Guardar'),
                        ),
                      ],
                    ),
                  ],
                ),
              );

              final preview = ExecutiveGlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Vista previa de sintaxis',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color:
                              theme.colorScheme.surface.withValues(alpha: 0.20),
                          border: Border.all(
                            color: theme.colorScheme.outlineVariant
                                .withValues(alpha: 0.65),
                          ),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: HighlightView(
                            _controller.text.isEmpty ? ' ' : _controller.text,
                            language: 'markdown',
                            theme: monokaiSublimeTheme,
                            padding: EdgeInsets.zero,
                            textStyle: const TextStyle(
                              fontFamily: 'Consolas',
                              fontSize: 13,
                              height: 1.45,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );

              final testHarness = ExecutiveGlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Probar prompt',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _testInputController,
                      minLines: 4,
                      maxLines: 6,
                      decoration: const InputDecoration(
                        hintText: 'Escribe un mensaje de prueba del cliente…',
                      ),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontFamily: 'Consolas',
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        FilledButton.icon(
                          onPressed: _isTesting ? null : _runTest,
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: Text(
                              _isTesting ? 'Ejecutando…' : 'Ejecutar prueba'),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Esto es una simulación solo de UI. Conecta tu runtime para ejecutar llamadas reales al proveedor.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.62),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_testOutput != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surface
                                .withValues(alpha: 0.16),
                            border: Border.all(
                              color: theme.colorScheme.outlineVariant
                                  .withValues(alpha: 0.65),
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(
                              _testOutput!,
                              style: theme.textTheme.bodyMedium
                                  ?.copyWith(height: 1.45),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              );

              if (isSingleColumn) {
                return Column(
                  children: [
                    editor,
                    const SizedBox(height: 14),
                    preview,
                    const SizedBox(height: 14),
                    testHarness,
                  ],
                );
              }

              return Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: editor),
                      const SizedBox(width: 14),
                      Expanded(child: preview),
                    ],
                  ),
                  const SizedBox(height: 14),
                  testHarness,
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _PromptVersion {
  const _PromptVersion({required this.createdAt, required this.content});

  final DateTime createdAt;
  final String content;
}

String _formatTimestamp(DateTime dt) {
  String two(int v) => v.toString().padLeft(2, '0');
  return '${dt.year}-${two(dt.month)}-${two(dt.day)} ${two(dt.hour)}:${two(dt.minute)}';
}
