import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Productos',
            subtitle:
                'Crea tu catálogo comercial, importa tablas de inventario y prepara imágenes y videos para que el bot venda con más contexto.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Estructura del catálogo',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                const _InfoRow(
                  icon: Icons.qr_code_2_outlined,
                  title: 'Identificador único',
                  subtitle: 'SKU, código interno o referencia comercial del producto.',
                ),
                const _InfoRow(
                  icon: Icons.inventory_2_outlined,
                  title: 'Nombre y descripción',
                  subtitle: 'Texto claro para que el bot explique beneficios y diferenciales.',
                ),
                const _InfoRow(
                  icon: Icons.sell_outlined,
                  title: 'Precio regular y precio oferta',
                  subtitle: 'Permite responder ventas normales y promociones.',
                ),
                const _InfoRow(
                  icon: Icons.percent_outlined,
                  title: 'Descuento y negociación',
                  subtitle: 'Controla cuánto margen puede manejar el bot en una conversación.',
                ),
                const _InfoRow(
                  icon: Icons.image_outlined,
                  title: 'Hasta 3 imágenes',
                  subtitle: 'Material visual ligero para mostrar el producto sin sobrecargar la operación.',
                ),
                const _InfoRow(
                  icon: Icons.video_library_outlined,
                  title: 'Videos de producto',
                  subtitle: 'Activos separados para enviar demostraciones solo cuando el cliente lo pida.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Importación sugerida',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Columnas recomendadas: identifier, name, description, salesPrice, offerPrice, discountPercent, negotiationAllowed, negotiationMarginPercent, currency, category, brand, benefits, availabilityText.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.72),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.add_box_outlined),
                      label: const Text('Crear producto'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.file_upload_outlined),
                      label: const Text('Importar tabla'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.download_outlined),
                      label: const Text('Plantilla CSV'),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: theme.colorScheme.surface.withValues(alpha: 0.16),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
              ),
            ),
            child: Icon(icon, size: 20, color: theme.colorScheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.64),
                    height: 1.35,
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
