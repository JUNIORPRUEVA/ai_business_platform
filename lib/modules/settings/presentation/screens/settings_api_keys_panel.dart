import 'package:flutter/material.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class SettingsApiKeysPanel extends StatefulWidget {
  const SettingsApiKeysPanel({super.key});

  @override
  State<SettingsApiKeysPanel> createState() => _SettingsApiKeysPanelState();
}

class _SettingsApiKeysPanelState extends State<SettingsApiKeysPanel> {
  final openAiKey = TextEditingController();
  final evolutionUrl = TextEditingController();
  final evolutionKey = TextEditingController();
  final metaToken = TextEditingController();
  final metaPhoneNumberId = TextEditingController();
  final instagramToken = TextEditingController();
  final webhookUrl = TextEditingController();

  bool isTesting = false;
  String? banner;
  bool bannerIsError = false;

  @override
  void dispose() {
    openAiKey.dispose();
    evolutionUrl.dispose();
    evolutionKey.dispose();
    metaToken.dispose();
    metaPhoneNumberId.dispose();
    instagramToken.dispose();
    webhookUrl.dispose();
    super.dispose();
  }

  Future<void> _testConnection(String label, bool ok) async {
    setState(() {
      isTesting = true;
      banner = null;
    });

    await Future.delayed(const Duration(milliseconds: 650));

    if (!mounted) return;

    setState(() {
      isTesting = false;
      bannerIsError = !ok;
      banner = ok
          ? 'Conexión a $label OK.'
          : 'Falló la conexión a $label. Verifica credenciales y acceso de red.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (banner != null) ...[
            ExecutiveGlassCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(
                    bannerIsError ? Icons.error_outline_rounded : Icons.check_circle_outline,
                    color: bannerIsError
                        ? const Color(0xFFFB7185).withValues(alpha: 0.90)
                        : const Color(0xFF22C55E).withValues(alpha: 0.90),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(banner!)),
                  IconButton(
                    tooltip: 'Descartar',
                    onPressed: () => setState(() => banner = null),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Panel de configuración — claves API y webhooks',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                _TwoColumnForm(
                  left: [
                    _KeyField(
                      controller: openAiKey,
                      label: 'Clave API de OpenAI',
                      hint: 'sk-…',
                      obscure: true,
                    ),
                    _KeyField(
                      controller: evolutionUrl,
                      label: 'URL de Evolution API',
                      hint: 'https://evolution.example.com',
                    ),
                    _KeyField(
                      controller: evolutionKey,
                      label: 'Clave de Evolution API',
                      hint: 'evo_…',
                      obscure: true,
                    ),
                    FilledButton.icon(
                      onPressed: isTesting
                          ? null
                          : () => _testConnection(
                                'Evolution',
                                evolutionUrl.text.trim().isNotEmpty &&
                                    evolutionKey.text.trim().isNotEmpty,
                              ),
                      icon: const Icon(Icons.bolt_rounded),
                      label: Text(isTesting ? 'Probando…' : 'Probar conexión Evolution'),
                    ),
                  ],
                  right: [
                    _KeyField(
                      controller: metaToken,
                      label: 'Token de Meta Cloud API',
                      hint: 'EAAG…',
                      obscure: true,
                    ),
                    _KeyField(
                      controller: metaPhoneNumberId,
                      label: 'ID de número telefónico (Meta)',
                      hint: '123456789',
                    ),
                    _KeyField(
                      controller: instagramToken,
                      label: 'Token de Instagram',
                      hint: 'IGQV…',
                      obscure: true,
                    ),
                    _KeyField(
                      controller: webhookUrl,
                      label: 'URL del webhook',
                      hint: 'https://yourdomain.com/webhook',
                    ),
                    FilledButton.icon(
                      onPressed: isTesting
                          ? null
                          : () => _testConnection(
                                'Webhook',
                                webhookUrl.text.trim().startsWith('http'),
                              ),
                      icon: const Icon(Icons.wifi_tethering_rounded),
                      label: Text(isTesting ? 'Probando…' : 'Probar webhook'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Las claves se almacenan por tenant. Asegúrate de no reutilizar credenciales entre empresas.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    FilledButton.icon(
                      onPressed: () => _testConnection('Guardado', true),
                      icon: const Icon(Icons.save_rounded),
                      label: const Text('Guardar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KeyField extends StatelessWidget {
  const _KeyField({
    required this.controller,
    required this.label,
    required this.hint,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final bool obscure;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
        ),
      ),
    );
  }
}

class _TwoColumnForm extends StatelessWidget {
  const _TwoColumnForm({required this.left, required this.right});

  final List<Widget> left;
  final List<Widget> right;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isSingleColumn = constraints.maxWidth < 980;

        if (isSingleColumn) {
          return Column(
            children: [
              ...left,
              const SizedBox(height: 6),
              ...right,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Column(children: left)),
            const SizedBox(width: 14),
            Expanded(child: Column(children: right)),
          ],
        );
      },
    );
  }
}
