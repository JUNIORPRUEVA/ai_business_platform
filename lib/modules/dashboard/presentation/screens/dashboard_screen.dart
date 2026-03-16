import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/application/auth_providers.dart';
import '../../../shared/presentation/widgets/module_header.dart';
import '../../../tenancy/application/tenancy_providers.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenant = ref.watch(selectedTenantProvider);
    final authState = ref.watch(authControllerProvider);

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
            subtitle:
                'Resumen operativo de ${tenant.name}. KPIs unificados en canales, herramientas y el runtime de IA.',
            trailing: FilledButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo bot'),
            ),
          ),
          const SizedBox(height: 16),
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
                    value: '\$ 24,830',
                    delta: '+4% esta semana',
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          const ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Vista previa de analítica\n\nConecta tus fuentes reales para poblar gráficas de volumen, tiempo de respuesta, conversiones y mix de canales.',
                ),
              ),
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
                        'Puedes revisar el estado de la conexión desde el módulo Canales.',
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
            child: Icon(icon, color: Colors.white.withValues(alpha: 0.92)),
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
