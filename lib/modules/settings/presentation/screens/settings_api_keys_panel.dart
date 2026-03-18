import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_api_client.dart';
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
  final rejectedCallReply = TextEditingController();
  final _apiClient = BotConfigurationCenterApiClient();

  bool autoApplyWebhook = true;
  bool trackConnectionEvents = true;
  bool trackQrEvents = true;
  bool trackMessageEvents = true;
  bool receiveTextMessages = true;
  bool receiveAudioMessages = true;
  bool receiveImageMessages = true;
  bool receiveVideoMessages = true;
  bool receiveDocumentMessages = true;
  bool persistMediaMetadata = true;
  String callHandlingMode = 'notify';

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
    rejectedCallReply.dispose();
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
      final whatsapp = _asMap(configuration['whatsapp']);

      openAiKey.text = _readString(openAi, 'apiKey');
      evolutionUrl.text = _readString(evolution, 'baseUrl');
      evolutionKey.text = _readString(evolution, 'apiKey');
      metaToken.text = _readString(integrations, 'metaCloudApiToken');
      metaPhoneNumberId.text = _readString(integrations, 'metaPhoneNumberId');
      instagramToken.text = _readString(integrations, 'instagramToken');
      webhookUrl.text = _readString(integrations, 'webhookUrl');
      rejectedCallReply.text = _readString(whatsapp, 'rejectedCallReply');
      autoApplyWebhook = _readBool(whatsapp, 'autoApplyWebhook', true);
      trackConnectionEvents =
          _readBool(whatsapp, 'trackConnectionEvents', true);
      trackQrEvents = _readBool(whatsapp, 'trackQrEvents', true);
      trackMessageEvents = _readBool(whatsapp, 'trackMessageEvents', true);
      receiveTextMessages = _readBool(whatsapp, 'receiveTextMessages', true);
      receiveAudioMessages = _readBool(whatsapp, 'receiveAudioMessages', true);
      receiveImageMessages = _readBool(whatsapp, 'receiveImageMessages', true);
      receiveVideoMessages = _readBool(whatsapp, 'receiveVideoMessages', true);
      receiveDocumentMessages =
          _readBool(whatsapp, 'receiveDocumentMessages', true);
      persistMediaMetadata = _readBool(whatsapp, 'persistMediaMetadata', true);
      callHandlingMode = _readString(whatsapp, 'callHandlingMode').isEmpty
          ? 'notify'
          : _readString(whatsapp, 'callHandlingMode');
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

      await _apiClient.putJson(
        '/bot-configuration/whatsapp',
        {
          'autoApplyWebhook': autoApplyWebhook,
          'trackConnectionEvents': trackConnectionEvents,
          'trackQrEvents': trackQrEvents,
          'trackMessageEvents': trackMessageEvents,
          'receiveTextMessages': receiveTextMessages,
          'receiveAudioMessages': receiveAudioMessages,
          'receiveImageMessages': receiveImageMessages,
          'receiveVideoMessages': receiveVideoMessages,
          'receiveDocumentMessages': receiveDocumentMessages,
          'persistMediaMetadata': persistMediaMetadata,
          'callHandlingMode': callHandlingMode,
          'rejectedCallReply': rejectedCallReply.text.trim(),
        },
        token: token,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        bannerIsError = false;
        banner =
            'Credenciales y politicas operativas de WhatsApp guardadas correctamente.';
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
                        'Las claves se almacenan por tenant. OpenAI, Evolution, Meta, Instagram y webhook ahora se guardan en la configuracion central del backend.',
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
          const SizedBox(height: 12),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Operacion de WhatsApp',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Define que tipo de mensajes entran al backend, que eventos mantiene el webhook y como quieres registrar las llamadas. Si ya tienes una instancia conectada, luego pulsa Configurar webhook en el canal de WhatsApp para reaplicar estos cambios.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
                  ),
                ),
                const SizedBox(height: 14),
                _TwoColumnForm(
                  left: [
                    _SwitchSettingTile(
                      title: 'Aplicar webhook automaticamente',
                      subtitle:
                          'Al crear o recrear la instancia, el backend vuelve a configurar el webhook con estas politicas.',
                      value: autoApplyWebhook,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => autoApplyWebhook = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Recibir mensajes de texto',
                      subtitle:
                          'Permite entradas normales de chat y textos extendidos.',
                      value: receiveTextMessages,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => receiveTextMessages = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Recibir audios y notas de voz',
                      subtitle:
                          'Acepta audioMessage y conserva metadatos como duracion y mimetype.',
                      value: receiveAudioMessages,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => receiveAudioMessages = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Recibir imagenes',
                      subtitle: 'Acepta imagenes con su caption cuando exista.',
                      value: receiveImageMessages,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => receiveImageMessages = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Recibir videos',
                      subtitle:
                          'Permite videos, con caption y segundos si Evolution los envia.',
                      value: receiveVideoMessages,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => receiveVideoMessages = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Recibir documentos y adjuntos',
                      subtitle:
                          'Acepta documentos y otros adjuntos que el proveedor reporta como archivo.',
                      value: receiveDocumentMessages,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => receiveDocumentMessages = value),
                    ),
                  ],
                  right: [
                    _SwitchSettingTile(
                      title: 'Seguir eventos de conexion',
                      subtitle:
                          'Mantiene actualizado el estado conectado, conectando o desconectado.',
                      value: trackConnectionEvents,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => trackConnectionEvents = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Seguir eventos de QR',
                      subtitle:
                          'Necesario para refrescar el QR de vinculacion desde Evolution.',
                      value: trackQrEvents,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => trackQrEvents = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Seguir eventos de mensajes',
                      subtitle:
                          'Activa messages.upsert para que el backend procese los mensajes entrantes.',
                      value: trackMessageEvents,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => trackMessageEvents = value),
                    ),
                    _SwitchSettingTile(
                      title: 'Guardar metadatos multimedia',
                      subtitle:
                          'Conserva mimetype, caption, duracion y carga cruda del mensaje cuando aplique.',
                      value: persistMediaMetadata,
                      enabled: !_isLoading && !_isSaving,
                      onChanged: (value) =>
                          setState(() => persistMediaMetadata = value),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: DropdownButtonFormField<String>(
                        value: callHandlingMode,
                        decoration: const InputDecoration(
                          labelText: 'Politica de llamadas entrantes',
                          helperText:
                              'WhatsApp/Evolution no expone aceptacion de llamadas en este flujo. Aqui defines si se ignoran, solo se registran o se marcan para rechazo si el proveedor lo soporta.',
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'ignore',
                            child: Text('Ignorar llamadas'),
                          ),
                          DropdownMenuItem(
                            value: 'notify',
                            child: Text('Registrar llamada'),
                          ),
                          DropdownMenuItem(
                            value: 'reject_if_supported',
                            child: Text('Rechazar si el proveedor lo permite'),
                          ),
                        ],
                        onChanged: (_isLoading || _isSaving)
                            ? null
                            : (value) {
                                if (value == null) {
                                  return;
                                }
                                setState(() => callHandlingMode = value);
                              },
                      ),
                    ),
                    _KeyField(
                      controller: rejectedCallReply,
                      label: 'Mensaje sugerido al rechazar llamada',
                      hint:
                          'Ahora mismo no atendemos llamadas. Escribenos por mensaje.',
                      enabled: !_isLoading && !_isSaving,
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

bool _readBool(Map<String, dynamic> json, String key, bool fallback) {
  final value = json[key];
  return value is bool ? value : fallback;
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

class _SwitchSettingTile extends StatelessWidget {
  const _SwitchSettingTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    required this.enabled,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6),
          ),
          color: theme.colorScheme.surface.withValues(alpha: 0.28),
        ),
        child: SwitchListTile.adaptive(
          value: value,
          onChanged: enabled ? onChanged : null,
          title: Text(
            title,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
            ),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 4,
          ),
        ),
      ),
    );
  }
}
