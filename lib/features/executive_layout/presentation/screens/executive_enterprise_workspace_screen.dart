import 'package:flutter/material.dart';

import '../../../../modules/ai_config/presentation/screens/ai_configuration_screen.dart';
import '../../../../modules/analytics/presentation/screens/analytics_screen.dart';
import '../../../../modules/automations/presentation/screens/automations_screen.dart';
import '../../../../modules/channels/presentation/screens/channels_screen.dart';
import '../../../../modules/dashboard/presentation/screens/dashboard_screen.dart';
import '../../../../modules/messages/presentation/screens/messages_screen.dart';
import '../../../../modules/products/presentation/screens/products_screen.dart';
import '../../../../modules/prompts_knowledge/presentation/screens/prompts_knowledge_screen.dart';
import '../../../../modules/settings/presentation/screens/settings_screen.dart';
import '../../../../modules/storage/presentation/screens/storage_screen.dart';
import '../../../../modules/tools/presentation/screens/tools_screen.dart';
import '../../../../modules/users/presentation/screens/users_roles_screen.dart';
import '../widgets/executive_content_container.dart';
import '../widgets/executive_layout.dart';
import '../widgets/executive_nav_item.dart';

class ExecutiveEnterpriseWorkspaceScreen extends StatelessWidget {
  const ExecutiveEnterpriseWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const items = [
      ExecutiveNavItem(label: 'Panel', icon: Icons.space_dashboard_outlined),
      ExecutiveNavItem(label: 'Mensajes', icon: Icons.forum_outlined),
      ExecutiveNavItem(label: 'Prompts y conocimiento', icon: Icons.psychology_outlined),
      ExecutiveNavItem(label: 'Productos', icon: Icons.inventory_2_outlined),
      ExecutiveNavItem(label: 'Herramientas', icon: Icons.handyman_outlined),
      ExecutiveNavItem(label: 'Canales', icon: Icons.hub_outlined),
      ExecutiveNavItem(label: 'Configuración de IA', icon: Icons.auto_awesome_outlined),
      ExecutiveNavItem(label: 'Almacenamiento', icon: Icons.folder_open_outlined),
      ExecutiveNavItem(label: 'Automatizaciones', icon: Icons.bolt_outlined),
      ExecutiveNavItem(label: 'Usuarios y roles', icon: Icons.admin_panel_settings_outlined),
      ExecutiveNavItem(label: 'Analítica', icon: Icons.query_stats_rounded),
      ExecutiveNavItem(label: 'Configuración', icon: Icons.settings_outlined),
    ];

    return ExecutiveLayout(
      title: 'Consola ejecutiva',
      items: items,
      builder: (context, selectedIndex) {
        switch (selectedIndex) {
          case 0:
            return const DashboardScreen();
          case 1:
            return const MessagesScreen();
          case 2:
            return const PromptsKnowledgeScreen();
          case 3:
            return const ProductsScreen();
          case 4:
            return const ToolsScreen();
          case 5:
            return const ChannelsScreen();
          case 6:
            return const AiConfigurationScreen();
          case 7:
            return const StorageScreen();
          case 8:
            return const AutomationsScreen();
          case 9:
            return const UsersRolesScreen();
          case 10:
            return const AnalyticsScreen();
          case 11:
            return const SettingsScreen();
          default:
            return _PlaceholderSection(title: items[selectedIndex].label);
        }
      },
    );
  }
}

class _PlaceholderSection extends StatelessWidget {
  const _PlaceholderSection({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 14),
          const ExecutiveGlassCard(
            child: Text(
              'Módulo en preparación.\nConecta aquí tus pantallas reales de ERP (operaciones, clientes, inventario, reportes).',
            ),
          ),
        ],
      ),
    );
  }
}
