import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_api_client.dart';
import '../../data/whatsapp_instances_api_client.dart';
import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

enum WhatsappChannelUiStatus {
  notConfigured,
  creating,
  waitingScan,
  connected,
  disconnected,
}

class WhatsappChannelScreen extends ConsumerStatefulWidget {
  const WhatsappChannelScreen({super.key});

  @override
  ConsumerState<WhatsappChannelScreen> createState() =>
      _WhatsappChannelScreenState();
}

class _WhatsappChannelScreenState extends ConsumerState<WhatsappChannelScreen> {
  final _instanceController = TextEditingController();
  final _api = WhatsappInstancesApiClient();
  final _configurationApi = BotConfigurationCenterApiClient();
  final _evolutionUrlController = TextEditingController();
  final _evolutionKeyController = TextEditingController();
  final _webhookUrlController = TextEditingController();
  final _rejectedCallReplyController = TextEditingController();

  WhatsappChannelUiStatus _status = WhatsappChannelUiStatus.notConfigured;
  String? _activeInstanceName;
  String? _qrBase64;
  String? _fieldError;
  String? _requestError;
  String? _providerMessage;
  Timer? _pollTimer;
  bool _loadingExisting = true;
  bool _loadingProviderSettings = true;
  bool _isMutatingInstance = false;
  bool _isSavingProviderSettings = false;
  bool _isTestingProviderConnection = false;
  bool _providerMessageIsError = false;
  bool _autoApplyWebhook = true;
  bool _trackConnectionEvents = true;
  bool _trackQrEvents = true;
  bool _trackMessageEvents = true;
  bool _receiveTextMessages = true;
  bool _receiveAudioMessages = true;
  bool _receiveImageMessages = true;
  bool _receiveVideoMessages = true;
  bool _receiveDocumentMessages = true;
  bool _persistMediaMetadata = true;
  String _callHandlingMode = 'notify';

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() async {
      await Future.wait([
        _loadExisting(),
        _loadProviderSettings(),
      ]);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _instanceController.dispose();
    _evolutionUrlController.dispose();
    _evolutionKeyController.dispose();
    _webhookUrlController.dispose();
    _rejectedCallReplyController.dispose();
    super.dispose();
  }

  Future<String?> _readToken() {
    return ref.read(authTokenStoreProvider).read();
  }

  Future<String> _requireToken() async {
    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }
    return token;
  }

  Future<void> _loadProviderSettings() async {
    setState(() {
      _loadingProviderSettings = true;
      _providerMessage = null;
    });

    try {
      final token = await _requireToken();
      final configuration =
          await _configurationApi.getJson('/bot-configuration', token: token);

      final evolution = _asMap(configuration['evolution']);
      final integrations = _asMap(configuration['integrations']);
      final whatsapp = _asMap(configuration['whatsapp']);

      _evolutionUrlController.text = _readString(evolution, 'baseUrl');
      _evolutionKeyController.text = _readString(evolution, 'apiKey');
      _webhookUrlController.text = _readString(integrations, 'webhookUrl');
      _rejectedCallReplyController.text =
          _readString(whatsapp, 'rejectedCallReply');
      _autoApplyWebhook = _readBool(whatsapp, 'autoApplyWebhook', true);
      _trackConnectionEvents =
          _readBool(whatsapp, 'trackConnectionEvents', true);
      _trackQrEvents = _readBool(whatsapp, 'trackQrEvents', true);
      _trackMessageEvents = _readBool(whatsapp, 'trackMessageEvents', true);
      _receiveTextMessages = _readBool(whatsapp, 'receiveTextMessages', true);
      _receiveAudioMessages = _readBool(whatsapp, 'receiveAudioMessages', true);
      _receiveImageMessages = _readBool(whatsapp, 'receiveImageMessages', true);
      _receiveVideoMessages = _readBool(whatsapp, 'receiveVideoMessages', true);
      _receiveDocumentMessages =
          _readBool(whatsapp, 'receiveDocumentMessages', true);
      _persistMediaMetadata = _readBool(whatsapp, 'persistMediaMetadata', true);
      _callHandlingMode = _readString(whatsapp, 'callHandlingMode').isEmpty
          ? 'notify'
          : _readString(whatsapp, 'callHandlingMode');
    } on BotConfigurationCenterApiException catch (error) {
      _providerMessageIsError = true;
      _providerMessage = error.message;
    } on AuthApiException catch (error) {
      _providerMessageIsError = true;
      _providerMessage = error.message;
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _loadingProviderSettings = false;
      });
    }
  }

  Future<void> _saveProviderSettings() async {
    setState(() {
      _isSavingProviderSettings = true;
      _providerMessage = null;
    });

    try {
      final token = await _requireToken();

      await _configurationApi.putJson(
        '/bot-configuration/evolution',
        {
          'baseUrl': _evolutionUrlController.text.trim(),
          'apiKey': _evolutionKeyController.text.trim(),
        },
        token: token,
      );

      await _configurationApi.putJson(
        '/bot-configuration/integrations',
        {
          'webhookUrl': _webhookUrlController.text.trim(),
        },
        token: token,
      );

      await _configurationApi.putJson(
        '/bot-configuration/whatsapp',
        {
          'autoApplyWebhook': _autoApplyWebhook,
          'trackConnectionEvents': _trackConnectionEvents,
          'trackQrEvents': _trackQrEvents,
          'trackMessageEvents': _trackMessageEvents,
          'receiveTextMessages': _receiveTextMessages,
          'receiveAudioMessages': _receiveAudioMessages,
          'receiveImageMessages': _receiveImageMessages,
          'receiveVideoMessages': _receiveVideoMessages,
          'receiveDocumentMessages': _receiveDocumentMessages,
          'persistMediaMetadata': _persistMediaMetadata,
          'callHandlingMode': _callHandlingMode,
          'rejectedCallReply': _rejectedCallReplyController.text.trim(),
        },
        token: token,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _providerMessageIsError = false;
        _providerMessage =
            'Configuración de Evolution y WhatsApp guardada correctamente.';
      });
    } on BotConfigurationCenterApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _providerMessageIsError = true;
        _providerMessage = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _providerMessageIsError = true;
        _providerMessage = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSavingProviderSettings = false;
      });
    }
  }

  Future<void> _testEvolutionConnection() async {
    setState(() {
      _isTestingProviderConnection = true;
      _providerMessage = null;
    });

    try {
      final token = await _requireToken();

      await _configurationApi.putJson(
        '/bot-configuration/evolution',
        {
          'baseUrl': _evolutionUrlController.text.trim(),
          'apiKey': _evolutionKeyController.text.trim(),
        },
        token: token,
      );

      final response = await _configurationApi.getJson(
        '/bot-configuration/evolution/connection',
        token: token,
      );

      final status =
          (response['connectionStatus'] as String? ?? 'desconocido').trim();

      if (!mounted) {
        return;
      }

      setState(() {
        _providerMessageIsError = false;
        _providerMessage = 'Estado de Evolution: $status.';
      });
    } on BotConfigurationCenterApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _providerMessageIsError = true;
        _providerMessage = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _providerMessageIsError = true;
        _providerMessage = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isTestingProviderConnection = false;
      });
    }
  }

  Future<void> _loadExisting() async {
    setState(() {
      _loadingExisting = true;
      _fieldError = null;
      _requestError = null;
    });

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      setState(() {
        _loadingExisting = false;
      });
      return;
    }

    try {
      final list = await _api.listInstances(token);
      if (list.isEmpty) {
        setState(() {
          _status = WhatsappChannelUiStatus.notConfigured;
          _activeInstanceName = null;
          _qrBase64 = null;
          _loadingExisting = false;
        });
        return;
      }

      final latest = list.first;
      final instanceName = (latest['instanceName'] as String?)?.trim();
      final rawStatus = (latest['status'] as String?)?.trim().toLowerCase();

      if (instanceName != null && instanceName.isNotEmpty) {
        _instanceController.text = instanceName;
        _activeInstanceName = instanceName;
      }

      final uiStatus = _mapStatus(rawStatus);

      setState(() {
        _status = uiStatus;
        _qrBase64 = (uiStatus == WhatsappChannelUiStatus.connected)
            ? null
            : (latest['qrCode'] as String?);
        _loadingExisting = false;
      });

      // If not connected, fetch fresh QR and start polling.
      if (uiStatus != WhatsappChannelUiStatus.connected &&
          _activeInstanceName != null) {
        await _fetchQr();
        _startPolling();
      }
    } on WhatsappInstancesApiException catch (e) {
      setState(() {
        _requestError = e.message;
        _loadingExisting = false;
      });
    }
  }

  WhatsappChannelUiStatus _mapStatus(String? status) {
    switch (status) {
      case 'created':
      case 'connecting':
        return WhatsappChannelUiStatus.waitingScan;
      case 'connected':
        return WhatsappChannelUiStatus.connected;
      case 'disconnected':
        return WhatsappChannelUiStatus.disconnected;
      default:
        return WhatsappChannelUiStatus.notConfigured;
    }
  }

  Future<void> _createInstance() async {
    final instanceName = _instanceController.text.trim();
    if (instanceName.isEmpty) {
      setState(() {
        _fieldError = 'Ingresa un nombre de instancia.';
        _requestError = null;
      });
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      setState(() {
        _fieldError = null;
        _requestError = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _status = WhatsappChannelUiStatus.creating;
      _fieldError = null;
      _requestError = null;
      _qrBase64 = null;
      _activeInstanceName = instanceName;
      _isMutatingInstance = true;
    });

    try {
      final created =
          await _api.createInstance(token: token, instanceName: instanceName);
      final savedName = (created['instanceName'] as String?)?.trim();
      if (savedName != null && savedName.isNotEmpty) {
        _activeInstanceName = savedName;
        _instanceController.text = savedName;
      }

      setState(() {
        _status = WhatsappChannelUiStatus.waitingScan;
      });

      await _fetchQr();
      _startPolling();
    } on WhatsappInstancesApiException catch (e) {
      setState(() {
        _status = WhatsappChannelUiStatus.notConfigured;
        _requestError = e.message;
        _isMutatingInstance = false;
      });
      return;
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _isMutatingInstance = false;
    });
  }

  Future<void> _fetchQr() async {
    final instanceName = _activeInstanceName?.trim();
    if (instanceName == null || instanceName.isEmpty) return;

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) return;

    try {
      final payload =
          await _api.getQr(token: token, instanceName: instanceName);
      final qr = payload['qrCode'] as String?;

      setState(() {
        _qrBase64 = qr;
        if (_status != WhatsappChannelUiStatus.connected) {
          _status = WhatsappChannelUiStatus.waitingScan;
        }
      });
    } on WhatsappInstancesApiException catch (e) {
      setState(() {
        _requestError = e.message;
      });
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();

    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      unawaited(_refreshStatus());
    });
  }

  Future<void> _refreshStatus() async {
    final instanceName = _activeInstanceName?.trim();
    if (instanceName == null || instanceName.isEmpty) return;

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) return;

    try {
      final payload =
          await _api.getStatus(token: token, instanceName: instanceName);
      final rawStatus = (payload['status'] as String?)?.trim().toLowerCase();
      final uiStatus = _mapStatus(rawStatus);

      if (!mounted) return;

      setState(() {
        _status = uiStatus;
        if (uiStatus == WhatsappChannelUiStatus.connected) {
          _qrBase64 = null;
        }
      });

      if (uiStatus == WhatsappChannelUiStatus.connected) {
        _pollTimer?.cancel();
      }
    } on WhatsappInstancesApiException {
      // Avoid spamming errors during polling.
    }
  }

  Future<void> _logoutInstance() async {
    final instanceName = _activeInstanceName?.trim();
    if (instanceName == null || instanceName.isEmpty) {
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _requestError = null;
      _isMutatingInstance = true;
    });

    try {
      await _api.logout(token: token, instanceName: instanceName);

      if (!mounted) {
        return;
      }

      setState(() {
        _status = WhatsappChannelUiStatus.disconnected;
        _qrBase64 = null;
        _isMutatingInstance = false;
      });

      await _fetchQr();
      _startPolling();
    } on WhatsappInstancesApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = e.message;
        _isMutatingInstance = false;
      });
    }
  }

  Future<void> _renameInstance() async {
    final currentName = _activeInstanceName?.trim();
    if (currentName == null || currentName.isEmpty) {
      return;
    }

    final controller = TextEditingController(text: currentName);
    final nextName = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Editar instancia'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Cambiar el nombre técnico recreará la instancia con el nuevo nombre. Si está conectada, primero debes desconectarla.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'Nuevo nombre de instancia',
                  hintText: 'mi-instancia-v2',
                ),
                autofocus: true,
                onSubmitted: (value) =>
                    Navigator.of(dialogContext).pop(value.trim()),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(dialogContext).pop(controller.text.trim()),
              child: const Text('Guardar cambio'),
            ),
          ],
        );
      },
    );
    controller.dispose();

    final normalizedName = nextName?.trim();
    if (normalizedName == null ||
        normalizedName.isEmpty ||
        normalizedName == currentName) {
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _requestError = null;
      _fieldError = null;
      _isMutatingInstance = true;
    });

    try {
      final updated = await _api.updateInstance(
        token: token,
        instanceName: currentName,
        newInstanceName: normalizedName,
      );
      final savedName =
          (updated['instanceName'] as String?)?.trim() ?? normalizedName;

      if (!mounted) {
        return;
      }

      setState(() {
        _activeInstanceName = savedName;
        _instanceController.text = savedName;
        _status = WhatsappChannelUiStatus.waitingScan;
        _qrBase64 = null;
        _isMutatingInstance = false;
      });

      await _fetchQr();
      _startPolling();
    } on WhatsappInstancesApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = e.message;
        _isMutatingInstance = false;
      });
    }
  }

  Future<void> _deleteInstance() async {
    final currentName = _activeInstanceName?.trim();
    if (currentName == null || currentName.isEmpty) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Eliminar instancia'),
          content: Text(
            'Se eliminará la instancia "$currentName" de Evolution y de esta cuenta. Esta acción no se puede deshacer.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Eliminar'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) {
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _requestError = null;
      _isMutatingInstance = true;
    });

    try {
      await _api.deleteInstance(token: token, instanceName: currentName);

      _pollTimer?.cancel();

      if (!mounted) {
        return;
      }

      setState(() {
        _activeInstanceName = null;
        _instanceController.clear();
        _status = WhatsappChannelUiStatus.notConfigured;
        _qrBase64 = null;
        _isMutatingInstance = false;
      });
    } on WhatsappInstancesApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = e.message;
        _isMutatingInstance = false;
      });
    }
  }

  Future<void> _configureWebhook() async {
    final currentName = _activeInstanceName?.trim();
    if (currentName == null || currentName.isEmpty) {
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _requestError = null;
      _isMutatingInstance = true;
    });

    try {
      final response = await _api.configureWebhook(
        token: token,
        instanceName: currentName,
      );
      final configuredUrl = (response['webhookUrl'] as String?)?.trim();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(
          content: Text(
            configuredUrl == null || configuredUrl.isEmpty
                ? 'Webhook configurado correctamente.'
                : 'Webhook configurado: $configuredUrl',
          ),
        ),
      );
    } on WhatsappInstancesApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _requestError = e.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isMutatingInstance = false;
      });
    }
  }

  Future<void> _showLargeQr(Uint8List qrBytes) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);

        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 24,
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final qrSize = constraints.maxWidth < 620
                  ? constraints.maxWidth - 48
                  : 520.0;

              return ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Escanea este QR',
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Abre WhatsApp en tu teléfono, entra en Dispositivos vinculados y apunta la cámara a este código.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.68),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(dialogContext).pop(),
                            icon: const Icon(Icons.close_rounded),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Center(
                        child: Container(
                          width: qrSize,
                          height: qrSize,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: [
                              BoxShadow(
                                color: theme.colorScheme.primary
                                    .withValues(alpha: 0.12),
                                blurRadius: 30,
                                offset: const Offset(0, 18),
                              ),
                            ],
                          ),
                          child: Image.memory(qrBytes, fit: BoxFit.contain),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Uint8List? _decodeQrBytes(String? value) {
    final raw = value?.trim();
    if (raw == null || raw.isEmpty) return null;

    final base64Part =
        raw.startsWith('data:image/') ? raw.split(',').last.trim() : raw;

    try {
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final badge = _buildStatusBadge(theme);
    final qrBytes = _decodeQrBytes(_qrBase64);
    final statusColor = _statusColor(theme);
    final statusTitle = _statusTitle();
    final statusDescription = _statusDescription();
    final canGoBack = Navigator.of(context).canPop();
    final nextAction = _nextActionCopy();

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ModuleHeader(
              title: 'WhatsApp Evolution API',
              subtitle:
                'Administra el proveedor Evolution y la vinculación de WhatsApp desde una sola pantalla simple.',
              trailing: canGoBack
                  ? OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('Volver'),
                    )
                  : null,
            ),
            const SizedBox(height: 14),
            ExecutiveGlassCard(
              padding: const EdgeInsets.all(22),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final compact = constraints.maxWidth < 860;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 14,
                        runSpacing: 14,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            width: compact ? double.infinity : 340,
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(22),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  statusColor.withValues(alpha: 0.20),
                                  theme.colorScheme.surface
                                      .withValues(alpha: 0.05),
                                ],
                              ),
                              border: Border.all(
                                color: statusColor.withValues(alpha: 0.24),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                badge,
                                const SizedBox(height: 14),
                                Text(
                                  statusTitle,
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  statusDescription,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.72),
                                  ),
                                ),
                                const SizedBox(height: 18),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(18),
                                    color: theme.colorScheme.surface
                                        .withValues(alpha: 0.14),
                                    border: Border.all(
                                      color: theme.colorScheme.outlineVariant
                                          .withValues(alpha: 0.42),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Siguiente paso',
                                        style:
                                            theme.textTheme.bodySmall?.copyWith(
                                          fontWeight: FontWeight.w900,
                                          color: theme.colorScheme.onSurface
                                              .withValues(alpha: 0.72),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        nextAction.title,
                                        style:
                                            theme.textTheme.bodyLarge?.copyWith(
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        nextAction.description,
                                        style:
                                            theme.textTheme.bodySmall?.copyWith(
                                          color: theme.colorScheme.onSurface
                                              .withValues(alpha: 0.68),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: compact
                                ? double.infinity
                                : constraints.maxWidth - 348,
                            child: Column(
                              children: [
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    _buildTopMetricCard(
                                      theme: theme,
                                      title: 'Instancia activa',
                                      value:
                                          _activeInstanceName ?? 'Sin definir',
                                      icon: Icons.dns_rounded,
                                    ),
                                    _buildTopMetricCard(
                                      theme: theme,
                                      title: 'Estado QR',
                                      value: qrBytes == null
                                          ? 'Pendiente'
                                          : 'Disponible',
                                      icon: Icons.qr_code_2_rounded,
                                    ),
                                    _buildTopMetricCard(
                                      theme: theme,
                                      title: 'Sincronización',
                                      value: _loadingExisting
                                          ? 'Cargando'
                                          : 'Lista',
                                      icon: Icons.sync_rounded,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                _buildJourneyStrip(theme),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (_requestError != null) ...[
                        const SizedBox(height: 16),
                        _buildErrorBanner(theme),
                      ],
                      if (_loadingExisting) ...[
                        const SizedBox(height: 16),
                        const LinearProgressIndicator(),
                      ],
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            ExecutiveGlassCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Proveedor Evolution',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Aquí configuras el servidor Evolution, la clave del proveedor, el webhook y el comportamiento del canal.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.68),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color:
                              theme.colorScheme.primary.withValues(alpha: 0.12),
                        ),
                        child: Text(
                          'Dentro de Canales',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_providerMessage != null) ...[
                    const SizedBox(height: 14),
                    _buildProviderBanner(theme),
                  ],
                  if (_loadingProviderSettings) ...[
                    const SizedBox(height: 14),
                    const LinearProgressIndicator(),
                  ],
                  const SizedBox(height: 16),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final compact = constraints.maxWidth < 980;

                      return Wrap(
                        spacing: 14,
                        runSpacing: 14,
                        children: [
                          SizedBox(
                            width: compact
                                ? constraints.maxWidth
                                : (constraints.maxWidth - 14) * 0.48,
                            child: Container(
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                color: theme.colorScheme.surface
                                    .withValues(alpha: 0.10),
                                border: Border.all(
                                  color: theme.colorScheme.outlineVariant
                                      .withValues(alpha: 0.48),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Conexión del proveedor',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Estos datos controlan la conexión con Evolution y el webhook principal del canal.',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface
                                          .withValues(alpha: 0.66),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  _buildConfigField(
                                    controller: _evolutionUrlController,
                                    label: 'URL de Evolution API',
                                    hint: 'https://evolution.example.com',
                                    enabled: !_isSavingProviderSettings &&
                                        !_loadingProviderSettings,
                                  ),
                                  _buildConfigField(
                                    controller: _evolutionKeyController,
                                    label: 'Clave de Evolution API',
                                    hint: 'evo_…',
                                    obscure: true,
                                    enabled: !_isSavingProviderSettings &&
                                        !_loadingProviderSettings,
                                  ),
                                  _buildConfigField(
                                    controller: _webhookUrlController,
                                    label: 'URL del webhook',
                                    hint: 'https://midominio.com/webhook',
                                    enabled: !_isSavingProviderSettings &&
                                        !_loadingProviderSettings,
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 10,
                                    runSpacing: 10,
                                    children: [
                                      FilledButton.icon(
                                        onPressed: _isSavingProviderSettings ||
                                                _loadingProviderSettings
                                            ? null
                                            : _saveProviderSettings,
                                        icon: _isSavingProviderSettings
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : const Icon(Icons.save_rounded),
                                        label: Text(_isSavingProviderSettings
                                            ? 'Guardando...'
                                            : 'Guardar configuración'),
                                      ),
                                      OutlinedButton.icon(
                                        onPressed:
                                            _isTestingProviderConnection ||
                                                    _loadingProviderSettings
                                                ? null
                                                : _testEvolutionConnection,
                                        icon: const Icon(Icons.bolt_rounded),
                                        label: Text(_isTestingProviderConnection
                                            ? 'Probando...'
                                            : 'Probar conexión'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          SizedBox(
                            width: compact
                                ? constraints.maxWidth
                                : (constraints.maxWidth - 14) * 0.52,
                            child: Container(
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                color: theme.colorScheme.surface
                                    .withValues(alpha: 0.10),
                                border: Border.all(
                                  color: theme.colorScheme.outlineVariant
                                      .withValues(alpha: 0.48),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Comportamiento de WhatsApp',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Mantén solo lo necesario para el cliente. Todo lo específico del canal se administra desde aquí.',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface
                                          .withValues(alpha: 0.66),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  _TwoColumnSwitchGrid(
                                    left: [
                                      _ConfigSwitchTile(
                                        title:
                                            'Aplicar webhook automáticamente',
                                        subtitle:
                                            'Vuelve a configurar el webhook al crear o recrear la instancia.',
                                        value: _autoApplyWebhook,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _autoApplyWebhook = value,
                                        ),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Seguir eventos de conexión',
                                        subtitle:
                                            'Actualiza el estado del canal cuando se conecta o desconecta.',
                                        value: _trackConnectionEvents,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _trackConnectionEvents = value,
                                        ),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Seguir eventos de QR',
                                        subtitle:
                                            'Permite refrescar el QR desde Evolution cuando cambia.',
                                        value: _trackQrEvents,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _trackQrEvents = value,
                                        ),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Seguir eventos de mensajes',
                                        subtitle:
                                            'Habilita el procesamiento de messages.upsert.',
                                        value: _trackMessageEvents,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _trackMessageEvents = value,
                                        ),
                                      ),
                                    ],
                                    right: [
                                      _ConfigSwitchTile(
                                        title: 'Recibir texto',
                                        subtitle:
                                            'Mensajes normales y textos extendidos.',
                                        value: _receiveTextMessages,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _receiveTextMessages = value,
                                        ),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Recibir audio',
                                        subtitle:
                                            'Audios y notas de voz reportadas por Evolution.',
                                        value: _receiveAudioMessages,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () => _receiveAudioMessages = value,
                                        ),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Recibir imágenes y videos',
                                        subtitle:
                                            'Adjuntos visuales con caption cuando exista.',
                                        value: _receiveImageMessages &&
                                            _receiveVideoMessages,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(() {
                                          _receiveImageMessages = value;
                                          _receiveVideoMessages = value;
                                        }),
                                      ),
                                      _ConfigSwitchTile(
                                        title: 'Recibir documentos',
                                        subtitle:
                                            'Documentos y otros adjuntos de archivo.',
                                        value: _receiveDocumentMessages,
                                        enabled: !_isSavingProviderSettings &&
                                            !_loadingProviderSettings,
                                        onChanged: (value) => setState(
                                          () =>
                                              _receiveDocumentMessages = value,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  _ConfigSwitchTile(
                                    title: 'Guardar metadatos multimedia',
                                    subtitle:
                                        'Conserva mimetype, caption, duración y datos relevantes del mensaje.',
                                    value: _persistMediaMetadata,
                                    enabled: !_isSavingProviderSettings &&
                                        !_loadingProviderSettings,
                                    onChanged: (value) => setState(
                                      () => _persistMediaMetadata = value,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  DropdownButtonFormField<String>(
                                    value: _callHandlingMode,
                                    decoration: const InputDecoration(
                                      labelText:
                                          'Política de llamadas entrantes',
                                      helperText:
                                          'Define si las llamadas se ignoran, solo se registran o se marcan para rechazo.',
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
                                        child: Text(
                                            'Rechazar si el proveedor lo permite'),
                                      ),
                                    ],
                                    onChanged: (_isSavingProviderSettings ||
                                            _loadingProviderSettings)
                                        ? null
                                        : (value) {
                                            if (value == null) {
                                              return;
                                            }
                                            setState(() {
                                              _callHandlingMode = value;
                                            });
                                          },
                                  ),
                                  const SizedBox(height: 12),
                                  _buildConfigField(
                                    controller: _rejectedCallReplyController,
                                    label:
                                        'Mensaje sugerido al rechazar llamada',
                                    hint:
                                        'Ahora mismo no atendemos llamadas. Escríbenos por mensaje.',
                                    enabled: !_isSavingProviderSettings &&
                                        !_loadingProviderSettings,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 960;

                return Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    SizedBox(
                      width: compact
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 14) * 0.42,
                      child: ExecutiveGlassCard(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Vinculación WhatsApp',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Usa un nombre fácil de reconocer para la cuenta y luego continúa con el escaneo del QR.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.68),
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _instanceController,
                              decoration: InputDecoration(
                                labelText: 'Nombre de instancia',
                                hintText: 'mi-instancia',
                                errorText: _fieldError,
                                prefixIcon:
                                    const Icon(Icons.settings_ethernet_rounded),
                              ),
                              enabled:
                                  _status != WhatsappChannelUiStatus.creating &&
                                      !_isMutatingInstance,
                              onChanged: (_) {
                                if (_fieldError != null) {
                                  setState(() {
                                    _fieldError = null;
                                  });
                                }
                              },
                              onSubmitted: (_) => _createInstance(),
                            ),
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                FilledButton.icon(
                                  onPressed: (_status ==
                                              WhatsappChannelUiStatus
                                                  .creating ||
                                          _isMutatingInstance)
                                      ? null
                                      : _createInstance,
                                  icon: const Icon(Icons.play_circle_outline),
                                  label: Text(
                                    _status ==
                                                WhatsappChannelUiStatus
                                                    .creating ||
                                            _isMutatingInstance
                                        ? 'Preparando...'
                                        : _activeInstanceName == null
                                            ? 'Crear y continuar'
                                            : 'Guardar cambios',
                                  ),
                                ),
                                OutlinedButton.icon(
                                  onPressed: (_status ==
                                              WhatsappChannelUiStatus
                                                  .creating ||
                                          _isMutatingInstance ||
                                          _activeInstanceName == null)
                                      ? null
                                      : () async {
                                          setState(() {
                                            _requestError = null;
                                          });
                                          await _fetchQr();
                                          await _refreshStatus();
                                        },
                                  icon: const Icon(Icons.refresh_rounded),
                                  label: const Text('Actualizar'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: (_activeInstanceName == null ||
                                          _isMutatingInstance)
                                      ? null
                                      : _renameInstance,
                                  icon: const Icon(Icons.edit_outlined),
                                  label: const Text('Editar'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: (_activeInstanceName == null ||
                                          _isMutatingInstance)
                                      ? null
                                      : _configureWebhook,
                                  icon:
                                      const Icon(Icons.wifi_tethering_rounded),
                                  label: const Text('Configurar webhook'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: (_activeInstanceName == null ||
                                          _isMutatingInstance)
                                      ? null
                                      : _deleteInstance,
                                  icon:
                                      const Icon(Icons.delete_outline_rounded),
                                  label: const Text('Eliminar'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),
                            _buildChecklist(theme),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: compact
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 14) * 0.58,
                      child: _status != WhatsappChannelUiStatus.connected
                          ? ExecutiveGlassCard(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Escanea el QR para conectar',
                                              style: theme.textTheme.titleMedium
                                                  ?.copyWith(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'Abre WhatsApp en tu teléfono, entra en Dispositivos vinculados y escanea el código. Cuando termine, el estado cambiará automáticamente.',
                                              style: theme.textTheme.bodySmall
                                                  ?.copyWith(
                                                color: theme
                                                    .colorScheme.onSurface
                                                    .withValues(alpha: 0.66),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 8),
                                        decoration: BoxDecoration(
                                          color: theme.colorScheme.primary
                                              .withValues(alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                          border: Border.all(
                                            color: theme.colorScheme.primary
                                                .withValues(alpha: 0.18),
                                          ),
                                        ),
                                        child: Text(
                                          qrBytes == null
                                              ? 'Esperando QR'
                                              : 'Listo para escanear',
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                            color: theme.colorScheme.primary,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 20),
                                  _buildSupportHint(theme),
                                  const SizedBox(height: 18),
                                  Center(
                                    child: AnimatedContainer(
                                      duration:
                                          const Duration(milliseconds: 220),
                                      width: compact ? 330 : 430,
                                      height: compact ? 330 : 430,
                                      padding: const EdgeInsets.all(20),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(30),
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            theme.colorScheme.surface
                                                .withValues(alpha: 0.26),
                                            theme.colorScheme.surface
                                                .withValues(alpha: 0.12),
                                          ],
                                        ),
                                        border: Border.all(
                                          color: qrBytes == null
                                              ? theme.colorScheme.outlineVariant
                                                  .withValues(alpha: 0.60)
                                              : theme.colorScheme.primary
                                                  .withValues(alpha: 0.24),
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: theme.colorScheme.primary
                                                .withValues(alpha: 0.10),
                                            blurRadius: 32,
                                            offset: const Offset(0, 20),
                                          ),
                                        ],
                                      ),
                                      child: (qrBytes == null)
                                          ? Column(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              children: [
                                                Icon(
                                                  Icons.qr_code_2_rounded,
                                                  size: 46,
                                                  color: theme
                                                      .colorScheme.onSurface
                                                      .withValues(alpha: 0.44),
                                                ),
                                                const SizedBox(height: 14),
                                                Text(
                                                  'QR no disponible todavía.',
                                                  style: theme
                                                      .textTheme.bodyMedium
                                                      ?.copyWith(
                                                    fontWeight: FontWeight.w700,
                                                    color: theme
                                                        .colorScheme.onSurface
                                                        .withValues(
                                                            alpha: 0.70),
                                                  ),
                                                ),
                                                const SizedBox(height: 8),
                                                Text(
                                                  'Cuando la instancia responda, el código aparecerá aquí.',
                                                  textAlign: TextAlign.center,
                                                  style: theme
                                                      .textTheme.bodySmall
                                                      ?.copyWith(
                                                    color: theme
                                                        .colorScheme.onSurface
                                                        .withValues(
                                                            alpha: 0.58),
                                                  ),
                                                ),
                                              ],
                                            )
                                          : DecoratedBox(
                                              decoration: BoxDecoration(
                                                color: Colors.white,
                                                borderRadius:
                                                    BorderRadius.circular(22),
                                              ),
                                              child: Padding(
                                                padding:
                                                    const EdgeInsets.all(16),
                                                child: Image.memory(qrBytes,
                                                    fit: BoxFit.contain),
                                              ),
                                            ),
                                    ),
                                  ),
                                  if (qrBytes != null) ...[
                                    const SizedBox(height: 18),
                                    Center(
                                      child: Wrap(
                                        spacing: 10,
                                        runSpacing: 10,
                                        alignment: WrapAlignment.center,
                                        children: [
                                          FilledButton.icon(
                                            onPressed: () =>
                                                _showLargeQr(qrBytes),
                                            icon:
                                                const Icon(Icons.zoom_out_map),
                                            label: const Text('Ver QR grande'),
                                          ),
                                          OutlinedButton.icon(
                                            onPressed: _isMutatingInstance
                                                ? null
                                                : _fetchQr,
                                            icon: const Icon(
                                                Icons.refresh_rounded),
                                            label: const Text('Actualizar QR'),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            )
                          : ExecutiveGlassCard(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 54,
                                        height: 54,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: const Color(0xFF22C55E)
                                              .withValues(alpha: 0.16),
                                          border: Border.all(
                                            color: const Color(0xFF22C55E)
                                                .withValues(alpha: 0.30),
                                          ),
                                        ),
                                        child: const Icon(
                                            Icons.verified_rounded,
                                            color: Color(0xFF22C55E)),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Canal conectado',
                                              style: theme.textTheme.titleMedium
                                                  ?.copyWith(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              'La instancia está operativa y lista para enviar o recibir mensajes.',
                                              style: theme.textTheme.bodySmall
                                                  ?.copyWith(
                                                color: theme
                                                    .colorScheme.onSurface
                                                    .withValues(alpha: 0.68),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 18),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(18),
                                      color: const Color(0xFF22C55E)
                                          .withValues(alpha: 0.08),
                                      border: Border.all(
                                        color: const Color(0xFF22C55E)
                                            .withValues(alpha: 0.18),
                                      ),
                                    ),
                                    child: Text(
                                      'Instancia activa: ${_activeInstanceName ?? 'Sin nombre'}',
                                      style:
                                          theme.textTheme.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Wrap(
                                    spacing: 10,
                                    runSpacing: 10,
                                    children: [
                                      OutlinedButton.icon(
                                        onPressed: _isMutatingInstance
                                            ? null
                                            : _refreshStatus,
                                        icon: const Icon(Icons.sync_rounded),
                                        label: const Text('Actualizar estado'),
                                      ),
                                      OutlinedButton.icon(
                                        onPressed: _isMutatingInstance
                                            ? null
                                            : _logoutInstance,
                                        icon:
                                            const Icon(Icons.link_off_rounded),
                                        label: const Text('Desconectar'),
                                      ),
                                      OutlinedButton.icon(
                                        onPressed: _isMutatingInstance
                                            ? null
                                            : _configureWebhook,
                                        icon: const Icon(
                                            Icons.wifi_tethering_rounded),
                                        label: const Text('Configurar webhook'),
                                      ),
                                      OutlinedButton.icon(
                                        onPressed: _isMutatingInstance
                                            ? null
                                            : _deleteInstance,
                                        icon: const Icon(
                                            Icons.delete_outline_rounded),
                                        label: const Text('Eliminar'),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'Qué puedes hacer ahora',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Puedes actualizar el estado, volver a aplicar el webhook guardado en Configuración > Claves API o desconectar la cuenta si necesitas escanear un nuevo QR.',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurface
                                          .withValues(alpha: 0.68),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopMetricCard({
    required ThemeData theme,
    required String title,
    required String value,
    required IconData icon,
  }) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 180, maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: theme.colorScheme.surface.withValues(alpha: 0.12),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.52),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon,
                size: 18,
                color: theme.colorScheme.primary.withValues(alpha: 0.92)),
            const SizedBox(height: 10),
            Text(
              title,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.64),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w900,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.92),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorBanner(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: const Color(0xFFEF4444).withValues(alpha: 0.10),
        border: Border.all(
          color: const Color(0xFFEF4444).withValues(alpha: 0.22),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _requestError!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.84),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProviderBanner(ThemeData theme) {
    final accent = _providerMessageIsError
        ? const Color(0xFFEF4444)
        : const Color(0xFF22C55E);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: accent.withValues(alpha: 0.10),
        border: Border.all(
          color: accent.withValues(alpha: 0.22),
        ),
      ),
      child: Row(
        children: [
          Icon(
            _providerMessageIsError
                ? Icons.error_outline_rounded
                : Icons.check_circle_outline,
            color: accent,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _providerMessage ?? '',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.84),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfigField({
    required TextEditingController controller,
    required String label,
    required String hint,
    bool obscure = false,
    required bool enabled,
  }) {
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

  Widget _buildChecklist(ThemeData theme) {
    final steps = <String>[
      'Escribe un nombre simple para la instancia, por ejemplo tienda_principal.',
      'Espera a que aparezca el QR en pantalla.',
      'Escanea el código desde WhatsApp y deja que el sistema confirme la conexión.',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Flujo recomendado',
          style:
              theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        ...steps.map(
          (step) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.colorScheme.primary.withValues(alpha: 0.16),
                  ),
                  child: Icon(
                    Icons.check_rounded,
                    size: 14,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    step,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.72),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildJourneyStrip(ThemeData theme) {
    final steps = [
      _JourneyStep(
        title: '1. Crear',
        description: 'Registrar la cuenta',
        isActive: _status == WhatsappChannelUiStatus.notConfigured ||
            _status == WhatsappChannelUiStatus.creating,
        isDone: _activeInstanceName != null,
      ),
      _JourneyStep(
        title: '2. Escanear QR',
        description: 'Vincular el teléfono',
        isActive: _status == WhatsappChannelUiStatus.waitingScan,
        isDone: _status == WhatsappChannelUiStatus.connected,
      ),
      _JourneyStep(
        title: '3. Operar',
        description: 'Canal listo',
        isActive: _status == WhatsappChannelUiStatus.connected,
        isDone: _status == WhatsappChannelUiStatus.connected,
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: theme.colorScheme.surface.withValues(alpha: 0.10),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.44),
        ),
      ),
      child: Wrap(
        spacing: 12,
        runSpacing: 12,
        children: steps
            .map((step) => _buildJourneyItem(theme: theme, step: step))
            .toList(growable: false),
      ),
    );
  }

  Widget _buildJourneyItem({
    required ThemeData theme,
    required _JourneyStep step,
  }) {
    final accent = step.isDone
        ? const Color(0xFF22C55E)
        : step.isActive
            ? theme.colorScheme.primary
            : theme.colorScheme.onSurface.withValues(alpha: 0.36);

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 170, maxWidth: 210),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: accent.withValues(
              alpha: step.isActive || step.isDone ? 0.12 : 0.06),
          border: Border.all(
            color: accent.withValues(alpha: 0.24),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              step.isDone
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_checked_rounded,
              size: 18,
              color: accent,
            ),
            const SizedBox(height: 10),
            Text(
              step.title,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w900,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.92),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              step.description,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSupportHint(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.smartphone_rounded,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Consejo: si el cliente está lejos de la pantalla, usa “Ver QR grande” para mostrarlo mucho más grande y facilitar el escaneo.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.74),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  ({String title, String description}) _nextActionCopy() {
    return switch (_status) {
      WhatsappChannelUiStatus.notConfigured => (
          title: 'Crear la instancia',
          description: 'Escribe un nombre simple y pulsa “Crear y continuar”.',
        ),
      WhatsappChannelUiStatus.creating => (
          title: 'Esperar la preparación',
          description:
              'En unos segundos se generará el QR para vincular el teléfono.',
        ),
      WhatsappChannelUiStatus.waitingScan => (
          title: 'Escanear el código QR',
          description:
              'Usa WhatsApp > Dispositivos vinculados y escanea el código grande de la derecha.',
        ),
      WhatsappChannelUiStatus.connected => (
          title: 'Operar normalmente',
          description: 'El canal ya está listo para recibir y enviar mensajes.',
        ),
      WhatsappChannelUiStatus.disconnected => (
          title: 'Reconectar la cuenta',
          description:
              'Actualiza el estado o desconecta para generar un nuevo QR.',
        ),
    };
  }

  Color _statusColor(ThemeData theme) {
    return switch (_status) {
      WhatsappChannelUiStatus.notConfigured =>
        theme.colorScheme.onSurface.withValues(alpha: 0.48),
      WhatsappChannelUiStatus.creating => const Color(0xFF165DFF),
      WhatsappChannelUiStatus.waitingScan => const Color(0xFFF59E0B),
      WhatsappChannelUiStatus.connected => const Color(0xFF22C55E),
      WhatsappChannelUiStatus.disconnected => const Color(0xFFEF4444),
    };
  }

  String _statusTitle() {
    return switch (_status) {
      WhatsappChannelUiStatus.notConfigured => 'Listo para configurar',
      WhatsappChannelUiStatus.creating => 'Creando infraestructura',
      WhatsappChannelUiStatus.waitingScan => 'Esperando vinculación',
      WhatsappChannelUiStatus.connected => 'Conexión establecida',
      WhatsappChannelUiStatus.disconnected => 'Conexión interrumpida',
    };
  }

  String _statusDescription() {
    return switch (_status) {
      WhatsappChannelUiStatus.notConfigured =>
        'Aún no existe una instancia activa. Configúrala para habilitar el canal.',
      WhatsappChannelUiStatus.creating =>
        'Se está registrando la instancia en Evolution API. Esto puede tardar unos segundos.',
      WhatsappChannelUiStatus.waitingScan =>
        'La instancia ya está lista. Solo falta escanear el QR desde WhatsApp.',
      WhatsappChannelUiStatus.connected =>
        'WhatsApp ya quedó vinculado y el canal puede operar normalmente.',
      WhatsappChannelUiStatus.disconnected =>
        'La instancia existe, pero perdió conexión y necesita reconexión o verificación.',
    };
  }

  Widget _buildStatusBadge(ThemeData theme) {
    final (label, color) = switch (_status) {
      WhatsappChannelUiStatus.notConfigured => (
          'No configurado',
          theme.colorScheme.onSurface.withValues(alpha: 0.55)
        ),
      WhatsappChannelUiStatus.creating => (
          'Creando instancia...',
          const Color(0xFF165DFF).withValues(alpha: 0.90)
        ),
      WhatsappChannelUiStatus.waitingScan => (
          'Esperando escaneo',
          const Color(0xFFF59E0B).withValues(alpha: 0.90)
        ),
      WhatsappChannelUiStatus.connected => (
          'Conectado ✅',
          const Color(0xFF22C55E).withValues(alpha: 0.90)
        ),
      WhatsappChannelUiStatus.disconnected => (
          'Desconectado ❌',
          const Color(0xFFEF4444).withValues(alpha: 0.90)
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: color.withValues(alpha: 0.14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _JourneyStep {
  const _JourneyStep({
    required this.title,
    required this.description,
    required this.isActive,
    required this.isDone,
  });

  final String title;
  final String description;
  final bool isActive;
  final bool isDone;
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return value.map(
      (key, nestedValue) => MapEntry(key.toString(), nestedValue),
    );
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

class _TwoColumnSwitchGrid extends StatelessWidget {
  const _TwoColumnSwitchGrid({
    required this.left,
    required this.right,
  });

  final List<Widget> left;
  final List<Widget> right;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final singleColumn = constraints.maxWidth < 860;

        if (singleColumn) {
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
            const SizedBox(width: 12),
            Expanded(child: Column(children: right)),
          ],
        );
      },
    );
  }
}

class _ConfigSwitchTile extends StatelessWidget {
  const _ConfigSwitchTile({
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
          color: theme.colorScheme.surface.withValues(alpha: 0.22),
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
