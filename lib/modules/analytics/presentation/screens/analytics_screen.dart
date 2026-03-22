import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Analítica',
            subtitle:
                'Rendimiento del bot: volumen de conversaciones, tiempo de respuesta, uso de IA, ventas generadas y mix de canales.',
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 960;

              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  for (final metric in const [
                    ('Conversaciones', '1,248', '+12%'),
                    ('Tiempo medio', '18s', '-6%'),
                    ('Takeover', '14%', '+2%'),
                    ('Costo IA', r'$4.20', '-9%'),
                  ])
                    SizedBox(
                      width: compact
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 24) / 4,
                      child: ExecutiveGlassCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(metric.$1, style: theme.textTheme.bodySmall),
                            const SizedBox(height: 10),
                            Text(
                              metric.$2,
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontSize: 24,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              metric.$3,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  SizedBox(
                    width: compact
                        ? constraints.maxWidth
                        : constraints.maxWidth * 0.62 - 8,
                    child: const ExecutiveGlassCard(
                      child: SizedBox(
                        height: 320,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Panel de analítica\n\nConecta gráficas y exportaciones aquí (por tenant). Vistas sugeridas: volumen en el tiempo, SLA, tasa de takeover, llamadas a herramientas y costo por conversación.',
                          ),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: compact
                        ? constraints.maxWidth
                        : constraints.maxWidth * 0.38 - 8,
                    child: const ExecutiveGlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Insights automáticos'),
                          SizedBox(height: 14),
                          _InsightLine(
                            text:
                                'Los mejores cierres llegan entre 10:00 y 14:00.',
                          ),
                          SizedBox(height: 10),
                          _InsightLine(
                            text:
                                'WhatsApp concentra el mayor volumen con menor fricción.',
                          ),
                          SizedBox(height: 10),
                          _InsightLine(
                            text:
                                'Las conversaciones con memoria activa convierten mejor.',
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

class _InsightLine extends StatelessWidget {
  const _InsightLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 4),
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: theme.textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}
