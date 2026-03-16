import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Herramientas',
            subtitle:
                'Conecta herramientas internas que el bot puede invocar: facturas, cotizaciones, pedidos, agenda, pagos, CRM e inventario.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Herramientas disponibles',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                const _ToolTile(
                  icon: Icons.receipt_long_outlined,
                  title: 'Generador de facturas',
                  subtitle: 'Crea facturas a partir del contexto del chat',
                  enabled: true,
                ),
                const SizedBox(height: 10),
                const _ToolTile(
                  icon: Icons.request_quote_outlined,
                  title: 'Generador de cotizaciones',
                  subtitle: 'Genera cotizaciones formales con ítems e impuestos',
                  enabled: true,
                ),
                const SizedBox(height: 10),
                const _ToolTile(
                  icon: Icons.inventory_2_outlined,
                  title: 'Acceso a inventario',
                  subtitle: 'Consulta stock y detalles de productos',
                  enabled: false,
                ),
                const SizedBox(height: 10),
                const _ToolTile(
                  icon: Icons.calendar_month_outlined,
                  title: 'Agenda de citas',
                  subtitle: 'Reserva citas y recordatorios',
                  enabled: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolTile extends StatefulWidget {
  const _ToolTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.enabled,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool enabled;

  @override
  State<_ToolTile> createState() => _ToolTileState();
}

class _ToolTileState extends State<_ToolTile> {
  late bool _enabled = widget.enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () {},
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: theme.colorScheme.surface.withValues(alpha: 0.16),
                border: Border.all(
                  color: theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
                ),
              ),
              child: Icon(widget.icon, color: Colors.white.withValues(alpha: 0.86), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.90),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.64),
                    ),
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              value: _enabled,
              onChanged: (value) => setState(() => _enabled = value),
            ),
            const SizedBox(width: 6),
            OutlinedButton(
              onPressed: () {},
              child: const Text('Configurar'),
            ),
          ],
        ),
      ),
    );
  }
}
