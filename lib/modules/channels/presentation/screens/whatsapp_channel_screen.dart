import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
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

  WhatsappChannelUiStatus _status = WhatsappChannelUiStatus.notConfigured;
  String? _activeInstanceName;
  String? _qrBase64;
  String? _fieldError;
  String? _requestError;
  String? _providerMessage;
  String? _webhookStatusMessage;
  Timer? _pollTimer;
  bool _loadingExisting = true;
  bool _loadingProviderSettings = true;
  bool _isMutatingInstance = false;
  bool _isSavingProviderSettings = false;
  bool _isTestingProviderConnection = false;
  bool _isCheckingWebhookStatus = false;
  bool _providerMessageIsError = false;
  bool _webhookStatusIsError = false;

  bool get _showAdvancedProviderPanel => kDebugMode;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() async {
      if (_showAdvancedProviderPanel) {
        await Future.wait([
          _loadExisting(),
          _loadProviderSettings(),
        ]);
        return;
      }

      await _loadExisting();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _instanceController.dispose();
    _evolutionUrlController.dispose();
    _evolutionKeyController.dispose();
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

      _evolutionUrlController.text = _readString(evolution, 'baseUrl');
      _evolutionKeyController.text = _readString(evolution, 'apiKey');
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

      if (!mounted) {
        return;
      }

      setState(() {
        _providerMessageIsError = false;
        _providerMessage = 'Configuración global de Evolution guardada correctamente.';
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

  Future<void> _checkWebhookStatus() async {
    final currentName = _activeInstanceName?.trim();
    if (currentName == null || currentName.isEmpty) {
      return;
    }

    setState(() {
      _isCheckingWebhookStatus = true;
      _webhookStatusMessage = null;
    });

    try {
      final token = await _requireToken();
      final response = await _api.getWebhookStatus(
        token: token,
        instanceName: currentName,
      );

      final matchesExpected = response['matchesExpected'] == true;
        final autoConfigured = response['autoConfigured'] == true;
      final isConfigured = response['isConfigured'] == true;
      final remoteWebhookUrl =
          (response['remoteWebhookUrl'] as String? ?? '').trim();
      final error = (response['error'] as String? ?? '').trim();

      if (!mounted) {
        return;
      }

      setState(() {
        _webhookStatusIsError = !matchesExpected;
        if (matchesExpected) {
          _webhookStatusMessage = autoConfigured
              ? 'Webhook configurado automaticamente y conectado correctamente en Evolution.'
              : 'Webhook conectado correctamente en Evolution.';
        } else if (error.isNotEmpty) {
          _webhookStatusMessage = error;
        } else if (!isConfigured) {
          _webhookStatusMessage =
              'Evolution no tiene un webhook configurado para esta instancia.';
        } else {
          _webhookStatusMessage = remoteWebhookUrl.isEmpty
              ? 'El webhook no coincide con la configuración esperada.'
              : 'Webhook detectado en Evolution, pero apunta a una URL distinta: $remoteWebhookUrl';
        }
      });
    } on WhatsappInstancesApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _webhookStatusIsError = true;
        _webhookStatusMessage = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _webhookStatusIsError = true;
        _webhookStatusMessage = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isCheckingWebhookStatus = false;
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
      body: Stack(
        children: [
          _buildAmbientBackground(theme),
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ModuleHeader(
                  title: 'WhatsApp Evolution API',
                  subtitle:
                    'Cada empresa solo necesita crear su instancia, escanear el QR y comenzar a operar.',
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
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(28),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  const Color(0xFF0F172A).withValues(alpha: 0.82),
                                  statusColor.withValues(alpha: 0.18),
                                  theme.colorScheme.surface.withValues(alpha: 0.06),
                                ],
                              ),
                              border: Border.all(
                                color: statusColor.withValues(alpha: 0.28),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: statusColor.withValues(alpha: 0.12),
                                  blurRadius: 28,
                                  offset: const Offset(0, 18),
                                ),
                              ],
                            ),
                            child: Stack(
                              children: [
                                Positioned(
                                  right: -20,
                                  top: -18,
                                  child: Container(
                                    width: 140,
                                    height: 140,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: statusColor.withValues(alpha: 0.08),
                                    ),
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Wrap(
                                      spacing: 10,
                                      runSpacing: 10,
                                      children: [
                                        badge,
                                        _buildSignalChip(
                                          theme: theme,
                                          icon: Icons.qr_code_scanner_rounded,
                                          label: 'Escaneo guiado',
                                        ),
                                        _buildSignalChip(
                                          theme: theme,
                                          icon: Icons.apartment_rounded,
                                          label: 'Instancia por empresa',
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 18),
                                    Wrap(
                                      spacing: 16,
                                      runSpacing: 16,
                                      crossAxisAlignment:
                                          WrapCrossAlignment.center,
                                      children: [
                                        SizedBox(
                                          width: compact ? double.infinity : 360,
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                statusTitle,
                                                style: theme.textTheme.headlineSmall?.copyWith(
                                                  fontWeight: FontWeight.w900,
                                                  height: 1.05,
                                                ),
                                              ),
                                              const SizedBox(height: 10),
                                              Text(
                                                statusDescription,
                                                style: theme.textTheme.bodyMedium?.copyWith(
                                                  color: theme.colorScheme.onSurface
                                                      .withValues(alpha: 0.76),
                                                  height: 1.5,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        SizedBox(
                                          width: compact
                                              ? double.infinity
                                              : constraints.maxWidth - 430,
                                          child: Wrap(
                                            spacing: 12,
                                            runSpacing: 12,
                                            children: [
                                              _buildTopMetricCard(
                                                theme: theme,
                                                title: 'Instancia activa',
                                                value: _activeInstanceName ??
                                                    'Sin definir',
                                                icon: Icons.dns_rounded,
                                              ),
                                              _buildTopMetricCard(
                                                theme: theme,
                                                title: 'Estado QR',
                                                value: qrBytes == null
                                                    ? 'Pendiente'
                                                    : 'Disponible',
                                                icon:
                                                    Icons.qr_code_2_rounded,
                                              ),
                                              if (_showAdvancedProviderPanel)
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
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 18),
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(20),
                                        color: Colors.white.withValues(alpha: 0.04),
                                        border: Border.all(
                                          color: Colors.white.withValues(alpha: 0.08),
                                        ),
                                      ),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 42,
                                            height: 42,
                                            decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(14),
                                              color: statusColor.withValues(
                                                  alpha: 0.14),
                                            ),
                                            child: Icon(
                                              Icons.arrow_outward_rounded,
                                              color: statusColor,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Siguiente paso',
                                                  style: theme.textTheme.bodySmall?.copyWith(
                                                    fontWeight: FontWeight.w900,
                                                    color: theme.colorScheme.onSurface
                                                        .withValues(alpha: 0.68),
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  nextAction.title,
                                                  style: theme.textTheme.titleMedium?.copyWith(
                                                    fontWeight: FontWeight.w900,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  nextAction.description,
                                                  style: theme.textTheme.bodySmall?.copyWith(
                                                    color: theme.colorScheme.onSurface
                                                        .withValues(alpha: 0.68),
                                                  ),
                                                ),
                                                const SizedBox(height: 8),
                                                Text(
                                                  'El webhook y la recepción de texto, audio, imagen, video y archivos se preparan automáticamente.',
                                                  style: theme.textTheme.bodySmall?.copyWith(
                                                    color: theme.colorScheme.primary
                                                        .withValues(alpha: 0.92),
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          _buildJourneyStrip(theme),
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
                if (_showAdvancedProviderPanel) ...[
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
                                    'Bloque visible solo en debug para validar la conexión global con Evolution. El webhook operativo se genera automáticamente.',
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
                                color: const Color(0xFFF59E0B)
                                    .withValues(alpha: 0.12),
                              ),
                              child: Text(
                                'Modo debug',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFFF59E0B),
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
                                      : constraints.maxWidth,
                                  child: Container(
                                    padding: const EdgeInsets.all(18),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(24),
                                      gradient: LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          theme.colorScheme.surface
                                              .withValues(alpha: 0.16),
                                          const Color(0xFF06B6D4)
                                              .withValues(alpha: 0.08),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: const Color(0xFF06B6D4)
                                            .withValues(alpha: 0.20),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFF06B6D4)
                                              .withValues(alpha: 0.08),
                                          blurRadius: 24,
                                          offset: const Offset(0, 16),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        _buildSectionEyebrow(
                                          theme: theme,
                                          label: 'PROVIDER NODE',
                                          accent: const Color(0xFF06B6D4),
                                        ),
                                        const SizedBox(height: 10),
                                        Text(
                                          'Conexión del proveedor',
                                          style: theme.textTheme.bodyMedium?.copyWith(
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'La URL pública del webhook se construye automáticamente desde el backend y los eventos inbound quedan siempre activos.',
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
                                        const SizedBox(height: 8),
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(18),
                                            color: Colors.white.withValues(alpha: 0.04),
                                            border: Border.all(
                                              color: Colors.white.withValues(alpha: 0.08),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'Automatización activa',
                                                style: theme.textTheme.bodyMedium?.copyWith(
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                'El sistema aplica el webhook automáticamente y deja habilitada la recepción de texto, audio, imágenes, videos y documentos.',
                                                style: theme.textTheme.bodySmall?.copyWith(
                                                  color: theme.colorScheme.onSurface
                                                      .withValues(alpha: 0.68),
                                                ),
                                              ),
                                            ],
                                          ),
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
                                              onPressed: _isTestingProviderConnection ||
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
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
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
                            _buildSectionEyebrow(
                              theme: theme,
                              label: 'PAIRING FLOW',
                              accent: statusColor,
                            ),
                            const SizedBox(height: 10),
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
                                      : _deleteInstance,
                                  icon:
                                      const Icon(Icons.delete_outline_rounded),
                                  label: const Text('Eliminar'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: (_activeInstanceName == null ||
                                          _isCheckingWebhookStatus)
                                      ? null
                                      : _checkWebhookStatus,
                                  icon: _isCheckingWebhookStatus
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(Icons.verified_user_rounded),
                                  label: Text(_isCheckingWebhookStatus
                                      ? 'Verificando...'
                                      : 'Verificar webhook'),
                                ),
                              ],
                            ),
                            if (_webhookStatusMessage != null) ...[
                              const SizedBox(height: 14),
                              _buildWebhookStatusBanner(theme),
                            ],
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
                                  _buildSectionEyebrow(
                                    theme: theme,
                                    label: 'SCAN MATRIX',
                                    accent: const Color(0xFFF59E0B),
                                  ),
                                  const SizedBox(height: 10),
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
                                    child: _buildQrShell(
                                      theme: theme,
                                      qrBytes: qrBytes,
                                      compact: compact,
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
                                              .withValues(alpha: 0.18),
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
                                      borderRadius: BorderRadius.circular(22),
                                      gradient: LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          const Color(0xFF22C55E)
                                              .withValues(alpha: 0.12),
                                          theme.colorScheme.surface
                                              .withValues(alpha: 0.08),
                                        ],
                                      ),
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
                                            : _deleteInstance,
                                        icon: const Icon(
                                            Icons.delete_outline_rounded),
                                        label: const Text('Eliminar'),
                                      ),
                                      OutlinedButton.icon(
                                        onPressed: _isCheckingWebhookStatus
                                            ? null
                                            : _checkWebhookStatus,
                                        icon: _isCheckingWebhookStatus
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : const Icon(
                                                Icons.verified_user_rounded),
                                        label: Text(_isCheckingWebhookStatus
                                            ? 'Verificando...'
                                            : 'Verificar webhook'),
                                      ),
                                    ],
                                  ),
                                  if (_webhookStatusMessage != null) ...[
                                    const SizedBox(height: 14),
                                    _buildWebhookStatusBanner(theme),
                                  ],
                                  const SizedBox(height: 14),
                                  Text(
                                    'Qué puedes hacer ahora',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Puedes actualizar el estado o desconectar la cuenta si necesitas escanear un nuevo QR. La sincronización técnica del canal se resuelve automáticamente en segundo plano.',
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
        ],
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
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.surface.withValues(alpha: 0.20),
              const Color(0xFF0F172A).withValues(alpha: 0.18),
            ],
          ),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.52),
          ),
          boxShadow: [
            BoxShadow(
              color: theme.colorScheme.primary.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon,
                    size: 18,
                    color: theme.colorScheme.primary.withValues(alpha: 0.92)),
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.colorScheme.primary.withValues(alpha: 0.82),
                  ),
                ),
              ],
            ),
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

  Widget _buildAmbientBackground(ThemeData theme) {
    return IgnorePointer(
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF06111F).withValues(alpha: 0.18),
                    theme.scaffoldBackgroundColor,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: -80,
            right: -40,
            child: _buildAmbientOrb(const Color(0xFF06B6D4), 220),
          ),
          Positioned(
            top: 220,
            left: -70,
            child: _buildAmbientOrb(const Color(0xFF14B8A6), 180),
          ),
          Positioned(
            bottom: 120,
            right: 40,
            child: _buildAmbientOrb(const Color(0xFFF59E0B), 140),
          ),
        ],
      ),
    );
  }

  Widget _buildAmbientOrb(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: 0.08),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.10),
            blurRadius: 80,
            spreadRadius: 8,
          ),
        ],
      ),
    );
  }

  Widget _buildSignalChip({
    required ThemeData theme,
    required IconData icon,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.white.withValues(alpha: 0.06),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.10),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.82),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionEyebrow({
    required ThemeData theme,
    required String label,
    required Color accent,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: accent.withValues(alpha: 0.12),
        border: Border.all(
          color: accent.withValues(alpha: 0.24),
        ),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: accent,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildQrShell({
    required ThemeData theme,
    required Uint8List? qrBytes,
    required bool compact,
  }) {
    final shellSize = compact ? 330.0 : 430.0;

    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: shellSize + 26,
          height: shellSize + 26,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(34),
            border: Border.all(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.10),
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: shellSize,
          height: shellSize,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                theme.colorScheme.surface.withValues(alpha: 0.30),
                const Color(0xFF0F172A).withValues(alpha: 0.20),
              ],
            ),
            border: Border.all(
              color: qrBytes == null
                  ? theme.colorScheme.outlineVariant.withValues(alpha: 0.60)
                  : const Color(0xFFF59E0B).withValues(alpha: 0.26),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                blurRadius: 34,
                offset: const Offset(0, 20),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                top: 0,
                left: 0,
                child: _buildScannerCorner(const Color(0xFFF59E0B)),
              ),
              Positioned(
                top: 0,
                right: 0,
                child: Transform.rotate(
                  angle: 1.5708,
                  child: _buildScannerCorner(const Color(0xFFF59E0B)),
                ),
              ),
              Positioned(
                bottom: 0,
                left: 0,
                child: Transform.rotate(
                  angle: -1.5708,
                  child: _buildScannerCorner(const Color(0xFFF59E0B)),
                ),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Transform.rotate(
                  angle: 3.14159,
                  child: _buildScannerCorner(const Color(0xFFF59E0B)),
                ),
              ),
              Positioned.fill(
                child: qrBytes == null
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.qr_code_2_rounded,
                            size: 52,
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.44),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'QR no disponible todavía.',
                            style:
                                theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.70),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Cuando la instancia responda, el código aparecerá aquí.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.58),
                            ),
                          ),
                        ],
                      )
                    : DecoratedBox(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Image.memory(qrBytes, fit: BoxFit.contain),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScannerCorner(Color color) {
    return SizedBox(
      width: 34,
      height: 34,
      child: CustomPaint(
        painter: _ScannerCornerPainter(color),
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

  Widget _buildWebhookStatusBanner(ThemeData theme) {
    final accent = _webhookStatusIsError
        ? const Color(0xFFF59E0B)
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
            _webhookStatusIsError
                ? Icons.info_outline_rounded
                : Icons.check_circle_outline,
            color: accent,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _webhookStatusMessage ?? '',
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

class _ScannerCornerPainter extends CustomPainter {
  const _ScannerCornerPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(size.width, 8)
      ..lineTo(8, 8)
      ..lineTo(8, size.height);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _ScannerCornerPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
