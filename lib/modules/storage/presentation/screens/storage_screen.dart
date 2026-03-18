import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/bot_configuration_center/data/services/bot_configuration_center_api_client.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../auth/data/auth_api_client.dart';
import '../../../shared/presentation/widgets/module_header.dart';

class StorageScreen extends ConsumerStatefulWidget {
  const StorageScreen({super.key});

  @override
  ConsumerState<StorageScreen> createState() => _StorageScreenState();
}

class _StorageScreenState extends ConsumerState<StorageScreen> {
  final _apiClient = BotConfigurationCenterApiClient();

  bool _isLoading = true;
  bool _isRefreshing = false;
  String? _error;
  Map<String, dynamic>? _diagnostics;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  Future<String> _requireToken() async {
    final token = await ref.read(authTokenStoreProvider).read();
    if (token == null || token.trim().isEmpty) {
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }
    return token;
  }

  Future<void> _load({bool refresh = false}) async {
    if (!mounted) {
      return;
    }

    setState(() {
      if (refresh) {
        _isRefreshing = true;
      } else {
        _isLoading = true;
      }
      _error = null;
    });

    try {
      final token = await _requireToken();
      final diagnostics = await _apiClient.getJson(
        '/bot-configuration/memory/diagnostics',
        token: token,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _diagnostics = diagnostics;
      });
    } on BotConfigurationCenterApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.message;
      });
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.message;
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoading = false;
        _isRefreshing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final diagnostics = _diagnostics;
    final counters = _mapValue(diagnostics?['counters']);
    final configuration = _mapValue(diagnostics?['configuration']);
    final features = _mapValue(diagnostics?['features']);
    final persistence = _mapValue(diagnostics?['persistence']);
    final postgres = _mapValue(persistence['postgres']);
    final redis = _mapValue(persistence['redis']);
    final activity = _mapValue(diagnostics?['activity']);
    final notes = _stringList(diagnostics?['notes']);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            title: 'Almacenamiento',
            subtitle:
                'Panel operativo para validar si la memoria consolidada del bot esta viva, persistiendo contexto y usando PostgreSQL y Redis como corresponde.',
            trailing: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: _isRefreshing ? null : () => _load(refresh: true),
                  icon: _isRefreshing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded),
                  label: Text(_isRefreshing ? 'Actualizando...' : 'Actualizar'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            _MessageBanner(message: _error!, isError: true),
            const SizedBox(height: 12),
          ],
          if (_isLoading) ...[
            const ExecutiveGlassCard(
              padding: EdgeInsets.all(16),
              child: LinearProgressIndicator(),
            ),
            const SizedBox(height: 12),
          ],
          if (diagnostics != null) ...[
            ExecutiveGlassCard(
              padding: const EdgeInsets.all(22),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final compact = constraints.maxWidth < 860;
                  final statusState = _stringValue(
                    diagnostics['overallState'],
                    fallback: 'degraded',
                  );
                  final statusColor = _statusColor(statusState);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 14,
                        runSpacing: 14,
                        children: [
                          Container(
                            width: compact ? double.infinity : 360,
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(22),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  statusColor.withValues(alpha: 0.20),
                                  theme.colorScheme.surface
                                      .withValues(alpha: 0.06),
                                ],
                              ),
                              border: Border.all(
                                color: statusColor.withValues(alpha: 0.28),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _StatePill(
                                  label: _stateLabel(statusState),
                                  state: statusState,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Memoria del bot',
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _stringValue(diagnostics['overallSummary']),
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    height: 1.45,
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.76),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  'Ultima lectura: ${_formatTimestamp(diagnostics['generatedAt'])}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.62),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: compact
                                ? double.infinity
                                : constraints.maxWidth - 388,
                            child: Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                _TopMetricCard(
                                  title: 'Memorias activas',
                                  value: _intValue(
                                    counters['conversationMemoryActive'],
                                  ).toString(),
                                  icon: Icons.memory_rounded,
                                ),
                                _TopMetricCard(
                                  title: 'Resumenes persistidos',
                                  value: _intValue(counters['summaries'])
                                      .toString(),
                                  icon: Icons.summarize_rounded,
                                ),
                                _TopMetricCard(
                                  title: 'Hechos del cliente',
                                  value: _intValue(counters['clientFacts'])
                                      .toString(),
                                  icon: Icons.psychology_alt_rounded,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 1120;
                final wideWidth = compact
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 14) / 2;

                return Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Infraestructura de memoria',
                        subtitle:
                            'Aqui ves si PostgreSQL y Redis estan realmente disponibles para el tenant autenticado.',
                        child: Column(
                          children: [
                            _InfrastructureTile(
                                title: 'PostgreSQL', status: postgres),
                            const SizedBox(height: 12),
                            _InfrastructureTile(title: 'Redis', status: redis),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Contadores persistentes',
                        subtitle:
                            'Estas cifras salen de las tablas reales de memoria, no de placeholders en la UI.',
                        child: Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            _MiniCounter(
                                label: 'Contactos',
                                value:
                                    _intValue(counters['contacts']).toString()),
                            _MiniCounter(
                                label: 'Conversaciones',
                                value: _intValue(counters['conversations'])
                                    .toString()),
                            _MiniCounter(
                                label: 'Memoria activa',
                                value: _intValue(
                                        counters['conversationMemoryActive'])
                                    .toString()),
                            _MiniCounter(
                                label: 'Memoria compactada',
                                value: _intValue(
                                        counters['conversationMemoryCompacted'])
                                    .toString()),
                            _MiniCounter(
                                label: 'Estado operacional',
                                value: _intValue(counters['operationalMemory'])
                                    .toString()),
                            _MiniCounter(
                                label: 'Facts del cliente',
                                value: _intValue(counters['clientFacts'])
                                    .toString()),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Politica activa',
                        subtitle:
                            'La UI ahora deja visible la configuracion que gobierna la arquitectura consolidada.',
                        child: Column(
                          children: [
                            _KeyValueRow(
                                label: 'Ventana reciente',
                                value:
                                    '${_intValue(configuration['recentMessageWindowSize'])} mensajes'),
                            _KeyValueRow(
                                label: 'Umbral de resumen',
                                value:
                                    '${_intValue(configuration['summaryRefreshThreshold'])} eventos'),
                            _KeyValueRow(
                                label: 'TTL objetivo',
                                value:
                                    _stringValue(configuration['memoryTtl'])),
                            _KeyValueRow(
                                label: 'PostgreSQL en memoria',
                                value:
                                    _boolLabel(configuration['usePostgreSql'])),
                            _KeyValueRow(
                                label: 'Redis en memoria',
                                value: _boolLabel(configuration['useRedis'])),
                            _KeyValueRow(
                                label: 'Resumen automatico',
                                value: _boolLabel(
                                    configuration['automaticSummarization'])),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Capas funcionales',
                        subtitle:
                            'Este bloque te dice que partes de la memoria estan habilitadas hoy mismo.',
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _FeatureChip(
                                label: 'Short-term',
                                enabled: _boolValue(features['shortTerm'])),
                            _FeatureChip(
                                label: 'Long-term',
                                enabled: _boolValue(features['longTerm'])),
                            _FeatureChip(
                                label: 'Operational',
                                enabled: _boolValue(features['operational'])),
                            _FeatureChip(
                                label: 'Summaries',
                                enabled: _boolValue(features['summaries'])),
                            _FeatureChip(
                                label: 'Deduplicacion',
                                enabled: _boolValue(features['deduplication'])),
                            _FeatureChip(
                                label: 'Pruning',
                                enabled: _boolValue(features['pruning'])),
                            _FeatureChip(
                                label: 'Debug',
                                enabled: _boolValue(features['debug'])),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 1120;
                final wideWidth = compact
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 14) / 2;

                return Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Actividad reciente',
                        subtitle:
                            'Sirve para comprobar si la memoria esta recibiendo trafico y si el resumidor ya esta corriendo.',
                        child: Column(
                          children: [
                            _KeyValueRow(
                                label: 'Ultimo evento persistido',
                                value: _formatTimestamp(
                                    activity['lastConversationMemoryAt'])),
                            _KeyValueRow(
                                label: 'Ultimo resumen generado',
                                value: _formatTimestamp(
                                    activity['lastSummaryAt'])),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: wideWidth,
                      child: _SectionCard(
                        title: 'Observaciones del sistema',
                        subtitle:
                            'Mensajes cortos para saber si falta trafico, si Redis no responde o si la capa aun esta vacia.',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: notes.isEmpty
                              ? [
                                  Text(
                                    'No hay alertas adicionales para este tenant.',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: theme.colorScheme.onSurface
                                          .withValues(alpha: 0.72),
                                    ),
                                  ),
                                ]
                              : notes
                                  .map(
                                    (note) => Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 10),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 8,
                                            height: 8,
                                            margin:
                                                const EdgeInsets.only(top: 6),
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: theme.colorScheme.primary,
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              note,
                                              style: theme.textTheme.bodyMedium
                                                  ?.copyWith(
                                                height: 1.45,
                                                color: theme
                                                    .colorScheme.onSurface
                                                    .withValues(alpha: 0.74),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                  .toList(),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = isError ? const Color(0xFFFB7185) : const Color(0xFF22C55E);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline_rounded : Icons.check_circle_rounded,
            color: color.withValues(alpha: 0.92),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: theme.textTheme.bodySmall?.copyWith(
              height: 1.45,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
            ),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _InfrastructureTile extends StatelessWidget {
  const _InfrastructureTile({required this.title, required this.status});

  final String title;
  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = _stringValue(status['state'], fallback: 'degraded');
    final accent = _statusColor(state);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
        color: accent.withValues(alpha: 0.10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: accent.withValues(alpha: 0.18),
            ),
            child: Icon(
              title == 'Redis' ? Icons.bolt_rounded : Icons.storage_rounded,
              color: accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    _StatePill(
                      label: _stringValue(status['label']),
                      state: state,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _stringValue(status['detail']),
                  style: theme.textTheme.bodySmall?.copyWith(
                    height: 1.45,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopMetricCard extends StatelessWidget {
  const _TopMetricCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SizedBox(
      width: 206,
      child: ExecutiveGlassCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: theme.colorScheme.primary.withValues(alpha: 0.18),
              ),
              child: Icon(icon, color: Colors.white.withValues(alpha: 0.92)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.68),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniCounter extends StatelessWidget {
  const _MiniCounter({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: 156,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.45),
        ),
        color: theme.colorScheme.surface.withValues(alpha: 0.24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({required this.label, required this.enabled});

  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = enabled ? const Color(0xFF22C55E) : const Color(0xFFF59E0B);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            enabled ? Icons.check_circle_outline_rounded : Icons.pause_circle,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 8),
          Text(
            '$label · ${enabled ? 'activo' : 'desactivado'}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatePill extends StatelessWidget {
  const _StatePill({required this.label, required this.state});

  final String label;
  final String state;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _statusColor(state);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: color.withValues(alpha: 0.14),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: Colors.white.withValues(alpha: 0.92),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _KeyValueRow extends StatelessWidget {
  const _KeyValueRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.68),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.92),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Map<String, dynamic> _mapValue(dynamic value) {
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

List<String> _stringList(dynamic value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList();
  }
  return const <String>[];
}

String _stringValue(dynamic value, {String fallback = 'Sin datos'}) {
  if (value is String && value.trim().isNotEmpty) {
    return value.trim();
  }
  return fallback;
}

int _intValue(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return 0;
}

bool _boolValue(dynamic value) => value == true;

String _boolLabel(dynamic value) => _boolValue(value) ? 'Activo' : 'No';

Color _statusColor(String state) {
  switch (state) {
    case 'healthy':
      return const Color(0xFF22C55E);
    case 'offline':
      return const Color(0xFFFB7185);
    default:
      return const Color(0xFFF59E0B);
  }
}

String _stateLabel(String state) {
  switch (state) {
    case 'healthy':
      return 'Operativa';
    case 'offline':
      return 'Fuera de linea';
    default:
      return 'Con atencion';
  }
}

String _formatTimestamp(dynamic value) {
  if (value is! String || value.trim().isEmpty) {
    return 'Sin actividad registrada';
  }

  final parsed = DateTime.tryParse(value.trim());
  if (parsed == null) {
    return value.trim();
  }

  final local = parsed.toLocal();
  final twoDigits = (int number) => number.toString().padLeft(2, '0');
  return '${twoDigits(local.day)}/${twoDigits(local.month)}/${local.year} ${twoDigits(local.hour)}:${twoDigits(local.minute)}';
}
