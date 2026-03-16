import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class AutomationsScreen extends StatefulWidget {
  const AutomationsScreen({super.key});

  @override
  State<AutomationsScreen> createState() => _AutomationsScreenState();
}

class _AutomationsScreenState extends State<AutomationsScreen> {
  bool welcomeEnabled = true;
  bool followUpEnabled = false;
  bool remindersEnabled = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Automatizaciones',
            subtitle:
                'Configura flujos automatizados: mensajes de bienvenida, seguimientos, campañas post-compra y recordatorios.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Flujos',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                SwitchListTile.adaptive(
                  value: welcomeEnabled,
                  onChanged: (v) => setState(() => welcomeEnabled = v),
                  title: const Text('Mensaje de bienvenida'),
                  subtitle: const Text('Envía un saludo cuando un usuario inicia una nueva conversación.'),
                ),
                SwitchListTile.adaptive(
                  value: followUpEnabled,
                  onChanged: (v) => setState(() => followUpEnabled = v),
                  title: const Text('Seguimiento si no hay respuesta'),
                  subtitle: const Text('Envía un seguimiento si el cliente no responde.'),
                ),
                SwitchListTile.adaptive(
                  value: remindersEnabled,
                  onChanged: (v) => setState(() => remindersEnabled = v),
                  title: const Text('Recordatorios al cliente'),
                  subtitle: const Text('Programa recordatorios para pagos, citas y renovaciones.'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
