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
  ConsumerState<WhatsappChannelScreen> createState() => _WhatsappChannelScreenState();
}

class _WhatsappChannelScreenState extends ConsumerState<WhatsappChannelScreen> {
  final _instanceController = TextEditingController();
  final _api = WhatsappInstancesApiClient();

  WhatsappChannelUiStatus _status = WhatsappChannelUiStatus.notConfigured;
  String? _activeInstanceName;
  String? _qrBase64;
  String? _error;
  Timer? _pollTimer;
  bool _loadingExisting = true;

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
      _error = null;
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
        _qrBase64 = (uiStatus == WhatsappChannelUiStatus.connected) ? null : (latest['qrCode'] as String?);
        _loadingExisting = false;
      });

      // If not connected, fetch fresh QR and start polling.
      if (uiStatus != WhatsappChannelUiStatus.connected && _activeInstanceName != null) {
        await _fetchQr();
        _startPolling();
      }
    } on WhatsappInstancesApiException catch (e) {
      setState(() {
        _error = e.message;
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
        _error = 'Ingresa un nombre de instancia.';
      });
      return;
    }

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) {
      setState(() {
        _error = 'Tu sesión expiró. Inicia sesión otra vez.';
      });
      return;
    }

    setState(() {
      _status = WhatsappChannelUiStatus.creating;
      _error = null;
      _qrBase64 = null;
      _activeInstanceName = instanceName;
    });

    try {
      final created = await _api.createInstance(token: token, instanceName: instanceName);
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
        _error = e.message;
      });
    }
  }

  Future<void> _fetchQr() async {
    final instanceName = _activeInstanceName?.trim();
    if (instanceName == null || instanceName.isEmpty) return;

    final token = await _readToken();
    if (token == null || token.trim().isEmpty) return;

    try {
      final payload = await _api.getQr(token: token, instanceName: instanceName);
      final qr = payload['qrCode'] as String?;

      setState(() {
        _qrBase64 = qr;
        if (_status != WhatsappChannelUiStatus.connected) {
          _status = WhatsappChannelUiStatus.waitingScan;
        }
      });
    } on WhatsappInstancesApiException catch (e) {
      setState(() {
        _error = e.message;
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
      final payload = await _api.getStatus(token: token, instanceName: instanceName);
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

  Uint8List? _decodeQrBytes(String? value) {
    final raw = value?.trim();
    if (raw == null || raw.isEmpty) return null;

    final base64Part = raw.startsWith('data:image/')
        ? raw.split(',').last.trim()
        : raw;

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

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ModuleHeader(
              title: 'Canal WhatsApp',
              subtitle: 'Crea y conecta una instancia Evolution API escaneando un QR.',
            ),
            const SizedBox(height: 14),
            ExecutiveGlassCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Estado',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      badge,
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _instanceController,
                    decoration: InputDecoration(
                      labelText: 'Nombre de instancia',
                      hintText: 'mi-instancia',
                      errorText: _error,
                    ),
                    enabled: _status != WhatsappChannelUiStatus.creating,
                    onSubmitted: (_) => _createInstance(),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      FilledButton.icon(
                        onPressed: (_status == WhatsappChannelUiStatus.creating)
                            ? null
                            : _createInstance,
                        icon: const Icon(Icons.add_circle_outline),
                        label: Text(
                          _status == WhatsappChannelUiStatus.creating
                              ? 'Creando instancia...'
                              : 'Crear instancia',
                        ),
                      ),
                    ],
                  ),
                  if (_loadingExisting) ...[
                    const SizedBox(height: 14),
                    const LinearProgressIndicator(),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (_status != WhatsappChannelUiStatus.connected) ...[
              ExecutiveGlassCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'QR para vincular WhatsApp',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: Container(
                        width: 260,
                        height: 260,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surface.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.60),
                          ),
                        ),
                        child: (qrBytes == null)
                            ? Center(
                                child: Text(
                                  'QR no disponible todavía.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                                  ),
                                ),
                              )
                            : Image.memory(qrBytes, fit: BoxFit.contain),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              ExecutiveGlassCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.verified_rounded, color: Colors.greenAccent.withValues(alpha: 0.92)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Conectado ✅',
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(ThemeData theme) {
    final (label, color) = switch (_status) {
      WhatsappChannelUiStatus.notConfigured => ('No configurado', theme.colorScheme.onSurface.withValues(alpha: 0.55)),
      WhatsappChannelUiStatus.creating => ('Creando instancia...', const Color(0xFF165DFF).withValues(alpha: 0.90)),
      WhatsappChannelUiStatus.waitingScan => ('Esperando escaneo', const Color(0xFFF59E0B).withValues(alpha: 0.90)),
      WhatsappChannelUiStatus.connected => ('Conectado ✅', const Color(0xFF22C55E).withValues(alpha: 0.90)),
      WhatsappChannelUiStatus.disconnected => ('Desconectado ❌', const Color(0xFFEF4444).withValues(alpha: 0.90)),
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
