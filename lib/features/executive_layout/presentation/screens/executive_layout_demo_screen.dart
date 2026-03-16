import 'package:flutter/material.dart';

import '../widgets/executive_content_container.dart';
import '../widgets/executive_layout.dart';
import '../widgets/executive_nav_item.dart';

class ExecutiveLayoutDemoScreen extends StatelessWidget {
  const ExecutiveLayoutDemoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const items = [
      ExecutiveNavItem(label: 'Panel', icon: Icons.space_dashboard_outlined),
      ExecutiveNavItem(label: 'Operaciones', icon: Icons.grid_view_rounded),
      ExecutiveNavItem(label: 'Clientes', icon: Icons.groups_outlined),
      ExecutiveNavItem(label: 'Productos', icon: Icons.inventory_2_outlined),
      ExecutiveNavItem(label: 'Servicios', icon: Icons.design_services_outlined),
      ExecutiveNavItem(label: 'Reportes', icon: Icons.query_stats_rounded),
      ExecutiveNavItem(label: 'Usuarios', icon: Icons.admin_panel_settings_outlined),
      ExecutiveNavItem(label: 'Configuración', icon: Icons.settings_outlined),
    ];

    return ExecutiveLayout(
      title: 'Consola ejecutiva',
      items: items,
      builder: (context, selectedIndex) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              items[selectedIndex].label,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final isNarrow = constraints.maxWidth < 900;
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    SizedBox(
                      width: isNarrow
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 16 * 2) / 3,
                      child: const ExecutiveGlassCard(
                        child: _KpiTile(
                          title: 'Ingresos',
                            value: '\$ 1.28M',
                          subtitle: 'Últimos 30 días',
                          icon: Icons.payments_outlined,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: isNarrow
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 16 * 2) / 3,
                      child: const ExecutiveGlassCard(
                        child: _KpiTile(
                          title: 'Operaciones',
                          value: '3,842',
                          subtitle: 'Procesadas hoy',
                          icon: Icons.auto_graph_rounded,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: isNarrow
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 16 * 2) / 3,
                      child: const ExecutiveGlassCard(
                        child: _KpiTile(
                          title: 'Clientes',
                          value: '12,490',
                          subtitle: 'Cuentas activas',
                          icon: Icons.groups_outlined,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 16),
            const ExecutiveGlassCard(
              padding: EdgeInsets.all(20),
              child: _PanelPlaceholder(),
            ),
          ],
        );
      },
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: theme.colorScheme.primary.withValues(alpha: 0.16),
            border: Border.all(
              color: theme.colorScheme.primary.withValues(alpha: 0.35),
            ),
          ),
          child: Icon(icon, color: theme.colorScheme.primary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: 12.5,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PanelPlaceholder extends StatelessWidget {
  const _PanelPlaceholder();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Resumen ejecutivo',
              style: theme.textTheme.titleLarge?.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            FilledButton.tonal(
              onPressed: () {},
              child: const Text('Generar reporte'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'Este es un shell ejecutivo premium: tarjetas glass, AppBar con blur, barra lateral oscura y diseño responsivo.\nReemplaza este panel con tus módulos reales de ERP (operaciones, clientes, inventario, reportes).',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontSize: 14,
            height: 1.5,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
          ),
        ),
        const SizedBox(height: 18),
        LayoutBuilder(
          builder: (context, constraints) {
            final isNarrow = constraints.maxWidth < 900;
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: isNarrow ? constraints.maxWidth : (constraints.maxWidth - 16) / 2,
                  child: ExecutiveGlassCard(
                    padding: const EdgeInsets.all(18),
                    child: _MiniList(
                      title: 'Actividad reciente',
                      rows: const [
                        _MiniRow('Facturas procesadas', '1,204'),
                        _MiniRow('Nuevos clientes', '38'),
                        _MiniRow('Aprobaciones pendientes', '6'),
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: isNarrow ? constraints.maxWidth : (constraints.maxWidth - 16) / 2,
                  child: ExecutiveGlassCard(
                    padding: const EdgeInsets.all(18),
                    child: _MiniList(
                      title: 'Insights del sistema',
                      rows: const [
                        _MiniRow('Automatizaciones activas', '12'),
                        _MiniRow('Latencia API (p95)', '180ms'),
                        _MiniRow('Incidentes', '0'),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _MiniList extends StatelessWidget {
  const _MiniList({required this.title, required this.rows});

  final String title;
  final List<_MiniRow> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        ...rows.map(
          (row) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    row.left,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontSize: 14,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                    ),
                  ),
                ),
                Text(
                  row.right,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MiniRow {
  const _MiniRow(this.left, this.right);

  final String left;
  final String right;
}
