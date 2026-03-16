import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class AiConfigurationScreen extends StatelessWidget {
  const AiConfigurationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Configuración de IA',
            subtitle:
                'Configura proveedores de IA (OpenAI, Anthropic) y el comportamiento del runtime: modelo, temperatura, estilo de respuesta y política de memoria.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Proveedor',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: 'OpenAI',
                  items: const [
                    DropdownMenuItem(value: 'OpenAI', child: Text('OpenAI')),
                    DropdownMenuItem(value: 'Anthropic', child: Text('Anthropic')),
                  ],
                  onChanged: (_) {},
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.hub_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: 'gpt-4.1-mini',
                        items: const [
                          DropdownMenuItem(
                            value: 'gpt-4.1-mini',
                            child: Text('gpt-4.1-mini'),
                          ),
                          DropdownMenuItem(
                            value: 'gpt-4.1',
                            child: Text('gpt-4.1'),
                          ),
                        ],
                        onChanged: (_) {},
                        decoration: const InputDecoration(
                          labelText: 'Modelo',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        initialValue: '0.4',
                        decoration: const InputDecoration(
                          labelText: 'Temperatura',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: 'Conciso, profesional y alineado a políticas',
                  decoration: const InputDecoration(
                    labelText: 'Estilo de respuesta',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: 'Memoria aislada por tenant con controles de retención',
                  decoration: const InputDecoration(
                    labelText: 'Comportamiento de memoria',
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Las credenciales del proveedor se administran en Configuración → Claves API.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.save_rounded),
                      label: const Text('Guardar'),
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
