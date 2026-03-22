import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_api_client.dart';
import '../../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';
import '../../../channels/presentation/screens/whatsapp_channel_screen.dart';

class SettingsApiKeysPanel extends ConsumerStatefulWidget {
  const SettingsApiKeysPanel({super.key});

  @override
  ConsumerState<SettingsApiKeysPanel> createState() =>
      _SettingsApiKeysPanelState();
}

class _SettingsApiKeysPanelState extends ConsumerState<SettingsApiKeysPanel> {
  final openAiKey = TextEditingController();
  final metaToken = TextEditingController();
  final metaPhoneNumberId = TextEditingController();
  final instagramToken = TextEditingController();
  final _apiClient = BotConfigurationCenterApiClient();

  bool _isLoading = true;
  bool _isSaving = false;
  bool _isTestingOpenAi = false;
  String? banner;
  bool bannerIsError = false;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  @override
  void dispose() {
    openAiKey.dispose();
    metaToken.dispose();
    metaPhoneNumberId.dispose();
    instagramToken.dispose();
    super.dispose();
  }

  Future<String> _requireToken() async {
    final token = await ref.read(authTokenStoreProvider).read();
    if (token == null || token.trim().isEmpty) {
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }
    return token;
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      banner = null;
    });

    try {
      final token = await _requireToken();
      final configuration =
          await _apiClient.getJson('/bot-configuration', token: token);

      final openAi = _asMap(configuration['openai']);
      final integrations = _asMap(configuration['integrations']);

      openAiKey.text = _readString(openAi, 'apiKey');
      metaToken.text = _readString(integrations, 'metaCloudApiToken');
      metaPhoneNumberId.text = _readString(integrations, 'metaPhoneNumberId');
      instagramToken.text = _readString(integrations, 'instagramToken');
    } on BotConfigurationCenterApiException catch (error) {
      bannerIsError = true;
      banner = error.message;
    } on AuthApiException catch (error) {
      bannerIsError = true;
      banner = error.message;
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _saveAll() async {
    setState(() {
      _isSaving = true;
      banner = null;
    });

    try {
      final token = await _requireToken();

      await _apiClient.putJson(
        '/bot-configuration/openai',
        {
          'apiKey': openAiKey.text.trim(),
        },
        token: token,
      );

      await _apiClient.putJson(
        '/bot-configuration/integrations',
        {
          'metaCloudApiToken': metaToken.text.trim(),
          'metaPhoneNumberId': metaPhoneNumberId.text.trim(),
          'instagramToken': instagramToken.text.trim(),
        },
        token: token,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        bannerIsError = false;
        banner = 'Claves generales guardadas correctamente.';
      });
    } on BotConfigurationCenterApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        bannerIsError = true;
        banner = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        bannerIsError = true;
        banner = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSaving = false;
      });
    }
  }

  Future<void> _testOpenAiKey() async {
    setState(() {
      _isTestingOpenAi = true;
      banner = null;
    });

    try {
      final token = await _requireToken();
      final result = await _apiClient.postJson(
        '/bot-configuration/openai/test',
        {
          'apiKey': openAiKey.text.trim(),
        },
        token: token,
      );

      if (!mounted) {
        return;
      }

      final source = (result['source'] as String?) ?? 'request_override';
      setState(() {
        bannerIsError = false;
        banner =
            'API key de OpenAI validada correctamente. Fuente usada: $source.';
      });
    } on BotConfigurationCenterApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        bannerIsError = true;
        banner = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        bannerIsError = true;
        banner = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isTestingOpenAi = false;
      });
    }
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
                    bannerIsError
                        ? Icons.error_outline_rounded
                        : Icons.check_circle_outline,
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
          if (_isLoading) ...[
            const ExecutiveGlassCard(
              padding: EdgeInsets.all(16),
              child: LinearProgressIndicator(),
            ),
            const SizedBox(height: 12),
          ],
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Panel de configuración — claves generales',
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
                      enabled: !_isLoading && !_isSaving,
                    ),
                  ],
                  right: [
                    _KeyField(
                      controller: metaToken,
                      label: 'Token de Meta Cloud API',
                      hint: 'EAAG…',
                      obscure: true,
                      enabled: !_isLoading && !_isSaving,
                    ),
                    _KeyField(
                      controller: metaPhoneNumberId,
                      label: 'ID de número telefónico (Meta)',
                      hint: '123456789',
                      enabled: !_isLoading && !_isSaving,
                    ),
                    _KeyField(
                      controller: instagramToken,
                      label: 'Token de Instagram',
                      hint: 'IGQV…',
                      obscure: true,
                      enabled: !_isLoading && !_isSaving,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Aquí se guardan solo las claves generales de la plataforma. La configuración específica de Evolution API y WhatsApp ahora vive dentro de Canales > WhatsApp Evolution API.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.62),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _isLoading || _isSaving || _isTestingOpenAi
                          ? null
                          : _testOpenAiKey,
                      icon: _isTestingOpenAi
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.bolt_rounded),
                      label: Text(
                        _isTestingOpenAi ? 'Probando...' : 'Probar API key',
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const WhatsappChannelScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const Text('Abrir canal'),
                    ),
                    const SizedBox(width: 10),
                    FilledButton.icon(
                      onPressed: _isLoading || _isSaving ? null : _saveAll,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_rounded),
                      label: Text(_isSaving ? 'Guardando...' : 'Guardar'),
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
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final bool obscure;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        enabled: enabled,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
        ),
      ),
    );
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  return const <String, dynamic>{};
}

String _readString(Map<String, dynamic> json, String key) {
  final value = json[key];
  return value is String ? value : '';
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
