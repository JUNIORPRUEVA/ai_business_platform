import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/application/auth_providers.dart';
import '../../data/whatsapp_instances_api_client.dart';
import '../../../shared/presentation/widgets/module_header.dart';
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

  WhatsappChannelUiStatus _status = WhatsappChannelUiStatus.notConfigured;
  String? _activeInstanceName;
  String? _qrBase64;
  String? _fieldError;
  String? _requestError;
  Timer? _pollTimer;
  bool _loadingExisting = true;
  bool _isMutatingInstance = false;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_loadExisting);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _instanceController.dispose();
    super.dispose();
  }

  Future<String?> _readToken() {
    return ref.read(authTokenStoreProvider).read();
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

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ModuleHeader(
              title: 'Canal WhatsApp',
              subtitle:
                  'Crea y conecta una instancia Evolution API con un flujo más claro de estado, QR y vinculación.',
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
                            width: compact ? double.infinity : 320,
                            padding: const EdgeInsets.all(18),
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
                              ],
                            ),
                          ),
                          SizedBox(
                            width: compact
                                ? double.infinity
                                : constraints.maxWidth - 348,
                            child: Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                _buildTopMetricCard(
                                  theme: theme,
                                  title: 'Instancia activa',
                                  value: _activeInstanceName ?? 'Sin definir',
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
                                  value:
                                      _loadingExisting ? 'Cargando' : 'Lista',
                                  icon: Icons.sync_rounded,
                                ),
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
                              'Configuración de instancia',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Define o actualiza el identificador técnico que usará Evolution API para este canal.',
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
                                  icon: const Icon(Icons.add_circle_outline),
                                  label: Text(
                                    _status ==
                                                WhatsappChannelUiStatus
                                                    .creating ||
                                            _isMutatingInstance
                                        ? 'Creando instancia...'
                                        : 'Crear instancia',
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
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'QR para vincular WhatsApp',
                                              style: theme.textTheme.titleMedium
                                                  ?.copyWith(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'Abre WhatsApp en tu teléfono, entra en Dispositivos vinculados y escanea el código para completar la conexión.',
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
                                  Center(
                                    child: AnimatedContainer(
                                      duration:
                                          const Duration(milliseconds: 220),
                                      width: 292,
                                      height: 292,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(24),
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
                                            blurRadius: 26,
                                            offset: const Offset(0, 16),
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
                                                    BorderRadius.circular(18),
                                              ),
                                              child: Padding(
                                                padding:
                                                    const EdgeInsets.all(10),
                                                child: Image.memory(qrBytes,
                                                    fit: BoxFit.contain),
                                              ),
                                            ),
                                    ),
                                  ),
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
                                            : _deleteInstance,
                                        icon: const Icon(
                                            Icons.delete_outline_rounded),
                                        label: const Text('Eliminar'),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'Opciones de la instancia',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Puedes actualizar el estado de conexión, desconectar la instancia para volver a vincularla o eliminarla. Para cambiar su nombre técnico, primero debes desconectarla.',
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

  Widget _buildChecklist(ThemeData theme) {
    final steps = <String>[
      'Crea una instancia con un nombre fácil de reconocer.',
      'Genera o actualiza el QR si aún no aparece.',
      'Escanea el código desde WhatsApp en tu teléfono.',
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
