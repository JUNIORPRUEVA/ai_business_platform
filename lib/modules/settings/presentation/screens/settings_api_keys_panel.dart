import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_token_store.dart';
import '../../../auth/data/auth_api_client.dart';
import '../../../auth/domain/auth_session.dart';
import '../../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';

class SettingsApiKeysPanel extends ConsumerStatefulWidget {
  const SettingsApiKeysPanel({super.key});

  @override
  ConsumerState<SettingsApiKeysPanel> createState() =>
      _SettingsApiKeysPanelState();
}

class _SettingsApiKeysPanelState extends ConsumerState<SettingsApiKeysPanel> {
  final openAiKey = TextEditingController();
  final evolutionUrl = TextEditingController();
  final evolutionKey = TextEditingController();
  final metaToken = TextEditingController();
  final metaPhoneNumberId = TextEditingController();
  final instagramToken = TextEditingController();
  final webhookUrl = TextEditingController();
  final _apiClient = BotConfigurationCenterApiClient();

  bool isTesting = false;
  bool _isLoading = true;
  bool _isSaving = false;
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
    evolutionUrl.dispose();
    evolutionKey.dispose();
    metaToken.dispose();
    metaPhoneNumberId.dispose();
    instagramToken.dispose();
    webhookUrl.dispose();
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
      final evolution = _asMap(configuration['evolution']);
      final integrations = _asMap(configuration['integrations']);

      openAiKey.text = _readString(openAi, 'apiKey');
      evolutionUrl.text = _readString(evolution, 'baseUrl');
      evolutionKey.text = _readString(evolution, 'apiKey');
      metaToken.text = _readString(integrations, 'metaCloudApiToken');
      metaPhoneNumberId.text = _readString(integrations, 'metaPhoneNumberId');
      instagramToken.text = _readString(integrations, 'instagramToken');
      webhookUrl.text = _readString(integrations, 'webhookUrl');
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
        '/bot-configuration/evolution',
        {
          'baseUrl': evolutionUrl.text.trim(),
          'apiKey': evolutionKey.text.trim(),
        },
        token: token,
      );

      await _apiClient.putJson(
        '/bot-configuration/integrations',
        {
          'metaCloudApiToken': metaToken.text.trim(),
          'metaPhoneNumberId': metaPhoneNumberId.text.trim(),
          'instagramToken': instagramToken.text.trim(),
          'webhookUrl': webhookUrl.text.trim(),
        },
        token: token,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        bannerIsError = false;
        banner = 'Credenciales guardadas correctamente.';
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

  Future<void> _testEvolutionConnection() async {
    setState(() {
      isTesting = true;
      banner = null;
    });

    try {
      final token = await _requireToken();
      await _apiClient.putJson(
        '/bot-configuration/evolution',
        {
          'baseUrl': evolutionUrl.text.trim(),
          'apiKey': evolutionKey.text.trim(),
        },
        token: token,
      );

      final response = await _apiClient.getJson(
        '/bot-configuration/evolution/connection',
        token: token,
      );

      final status =
          (response['connectionStatus'] as String? ?? 'desconocido').trim();

      if (!mounted) {
        return;
      }

      setState(() {
        bannerIsError = false;
        banner = 'Estado de Evolution: $status.';
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
        isTesting = false;
      });
    }
  }

  Future<void> _testWebhook() async {
    setState(() {
      isTesting = true;
      banner = null;
    });

    final parsedUrl = Uri.tryParse(webhookUrl.text.trim());
    final isValid = parsedUrl != null &&
        (parsedUrl.scheme == 'http' || parsedUrl.scheme == 'https') &&
        (parsedUrl.host.isNotEmpty);

    if (!mounted) {
      return;
    }

    setState(() {
      isTesting = false;
      bannerIsError = !isValid;
      banner = isValid
          ? 'Webhook válido y listo para guardarse.'
          : 'La URL del webhook no es válida.';
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
                      enabled: !_isLoading && !_isSaving,
                    ),
                    _KeyField(
                      controller: evolutionUrl,
                      label: 'URL de Evolution API',
                      hint: 'https://evolution.example.com',
                      enabled: !_isLoading && !_isSaving,
                    ),
                    _KeyField(
                      controller: evolutionKey,
                      label: 'Clave de Evolution API',
                      hint: 'evo_…',
                      obscure: true,
                      enabled: !_isLoading && !_isSaving,
                    ),
                    FilledButton.icon(
                      onPressed: isTesting || _isLoading || _isSaving
                          ? null
                          : _testEvolutionConnection,
                      icon: const Icon(Icons.bolt_rounded),
                      label: Text(isTesting
                          ? 'Probando…'
                          : 'Probar conexión Evolution'),
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
                    _KeyField(
                      controller: webhookUrl,
                      label: 'URL del webhook',
                      hint: 'https://yourdomain.com/webhook',
                      enabled: !_isLoading && !_isSaving,
                    ),
                    FilledButton.icon(
                      onPressed: isTesting || _isLoading || _isSaving
                          ? null
                          : _testWebhook,
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
                        'Las claves se almacenan por tenant. OpenAI, Evolution, Meta, Instagram y webhook ahora se guardan en la configuración central del backend.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.62),
                        ),
                      ),
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
