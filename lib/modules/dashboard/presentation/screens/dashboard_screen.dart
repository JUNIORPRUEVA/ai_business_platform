import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import '../../../auth/application/auth_providers.dart';
import '../../../shared/presentation/widgets/module_header.dart';
import '../../../tenancy/application/tenancy_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenant = ref.watch(selectedTenantProvider);
    final authState = ref.watch(authControllerProvider);
    final subtitle =
        'Resumen operativo de ${tenant.name}. KPIs unificados en canales, herramientas y el runtime de IA.';

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (authState.noticeMessage != null) ...[
            _RegistrationNotice(
              message: authState.noticeMessage!,
              onDismiss: () =>
                  ref.read(authControllerProvider.notifier).clearNotice(),
            ),
            const SizedBox(height: 16),
          ],
          ModuleHeader(
            title: 'Panel',
            subtitle: subtitle,
            trailing: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.file_download_outlined),
                  label: const Text('Exportar'),
                ),
                FilledButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Nuevo bot'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _StatusBadge(label: 'Ventas asistidas activas'),
              _StatusBadge(label: 'Memoria conversacional sincronizada'),
              _StatusBadge(label: 'Operacion multiempresa segura'),
            ],
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final isNarrow = constraints.maxWidth < 980;
              final crossAxisCount = isNarrow ? 2 : 4;

              return GridView.count(
                crossAxisCount: crossAxisCount,
                crossAxisSpacing: 14,
                mainAxisSpacing: 14,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: const [
                  _KpiCard(
                    icon: Icons.forum_outlined,
                    label: 'Conversaciones',
                    value: '1,248',
                    delta: '+12% esta semana',
                  ),
                  _KpiCard(
                    icon: Icons.timer_outlined,
                    label: 'Respuesta prom.',
                    value: '18s',
                    delta: '-6% esta semana',
                  ),
                  _KpiCard(
                    icon: Icons.bolt_outlined,
                    label: 'Uso de IA',
                    value: '63k tokens',
                    delta: '+9% esta semana',
                  ),
                  _KpiCard(
                    icon: Icons.attach_money_rounded,
                    label: 'Ventas asistidas',
                    value: r'$ 24,830',
                    delta: '+4% esta semana',
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final stacked = constraints.maxWidth < 980;
              final primaryWidth = stacked
                  ? constraints.maxWidth
                  : constraints.maxWidth * 0.58 - 8;
              final secondaryWidth = stacked
                  ? constraints.maxWidth
                  : constraints.maxWidth * 0.42 - 8;

              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  SizedBox(
                    width: primaryWidth,
                    child: const ExecutiveGlassCard(
                      child: SizedBox(
                        height: 260,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _InsightHeader(
                              title: 'Pulso del negocio',
                              subtitle:
                                  'Vista rapida del rendimiento comercial y operacional.',
                            ),
                            SizedBox(height: 18),
                            Expanded(
                              child: _DashboardTrendPlaceholder(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: secondaryWidth,
                    child: const ExecutiveGlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _InsightHeader(
                            title: 'Prioridades de hoy',
                            subtitle:
                                'Tareas operativas con mayor impacto inmediato.',
                          ),
                          SizedBox(height: 18),
                          _PriorityItem(
                            title: 'Revisar canal WhatsApp',
                            subtitle:
                                'Confirmar QR activo y estabilidad de webhooks.',
                          ),
                          SizedBox(height: 12),
                          _PriorityItem(
                            title: 'Ajustar prompts de ventas',
                            subtitle:
                                'Subir precision comercial para campanas activas.',
                          ),
                          SizedBox(height: 12),
                          _PriorityItem(
                            title: 'Auditar tiempos de respuesta',
                            subtitle:
                                'Detectar conversaciones con takeover mas lento.',
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
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: theme.colorScheme.surface,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurface.withValues(alpha: 0.78),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _InsightHeader extends StatelessWidget {
  const _InsightHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
        ),
        const SizedBox(height: 6),
        Text(subtitle, style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _DashboardTrendPlaceholder extends StatelessWidget {
  const _DashboardTrendPlaceholder();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const barHeights = <double>[0.34, 0.62, 0.48, 0.74, 0.58, 0.88, 0.70];

    return Column(
      children: [
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final height in barHeights)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: FractionallySizedBox(
                        heightFactor: height,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                theme.colorScheme.primary
                                    .withValues(alpha: 0.82),
                                theme.colorScheme.tertiary
                                    .withValues(alpha: 0.58),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Lun'),
            Text('Mar'),
            Text('Mie'),
            Text('Jue'),
            Text('Vie'),
            Text('Sab'),
            Text('Dom'),
          ],
        ),
      ],
    );
  }
}

class _PriorityItem extends StatelessWidget {
  const _PriorityItem({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.34),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: theme.colorScheme.primary.withValues(alpha: 0.12),
            ),
            child: Icon(
              Icons.arrow_outward_rounded,
              size: 16,
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(subtitle, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RegistrationNotice extends StatelessWidget {
  const _RegistrationNotice({
    required this.message,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: const Color(0xFF0F766E).withValues(alpha: 0.18),
              border: Border.all(
                color: const Color(0xFF5EEAD4).withValues(alpha: 0.32),
              ),
            ),
            child: const Icon(
              Icons.check_circle_outline_rounded,
              color: Color(0xFF99F6E4),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Onboarding completado',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.94),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    height: 1.45,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.76),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: onDismiss,
                      icon: const Icon(Icons.done_rounded),
                      label: const Text('Entendido'),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Text(
                        'Puedes revisar el estado de la conexion desde el modulo Canales.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.62),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
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

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.delta,
  });

  final IconData icon;
  final String label;
  final String value;
  final String delta;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: theme.colorScheme.primary.withValues(alpha: 0.18),
              border: Border.all(
                color: theme.colorScheme.primary.withValues(alpha: 0.28),
              ),
            ),
            child: Icon(icon, color: theme.colorScheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.92),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  delta,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.secondary.withValues(alpha: 0.85),
                    fontWeight: FontWeight.w700,
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
