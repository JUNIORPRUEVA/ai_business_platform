import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import 'whatsapp_channel_screen.dart';

class ChannelsScreen extends StatelessWidget {
  const ChannelsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Canales',
            subtitle:
                'Conecta plataformas de mensajería: WhatsApp Evolution API, WhatsApp Meta Cloud API, Instagram, Messenger y chat web.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Canales conectados',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                _ChannelCard(
                  title: 'WhatsApp Evolution API',
                  subtitle: 'Gateway principal vía servidor Evolution',
                  connected: true,
                  icon: Icons.chat_rounded,
                  onConfigure: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const WhatsappChannelScreen(),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 12),
                const _ChannelCard(
                  title: 'WhatsApp Meta Cloud API',
                  subtitle: 'Proveedor oficial de Meta Cloud',
                  connected: false,
                  icon: Icons.cloud_outlined,
                ),
                const SizedBox(height: 12),
                const _ChannelCard(
                  title: 'Instagram',
                  subtitle: 'Ingesta de DMs y comentarios',
                  connected: false,
                  icon: Icons.camera_alt_outlined,
                ),
                const SizedBox(height: 12),
                const _ChannelCard(
                  title: 'Facebook Messenger',
                  subtitle: 'Conversaciones + webhooks',
                  connected: false,
                  icon: Icons.facebook_outlined,
                ),
                const SizedBox(height: 12),
                const _ChannelCard(
                  title: 'Chat web',
                  subtitle: 'Widget web + takeover por operador en vivo',
                  connected: true,
                  icon: Icons.web_outlined,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChannelCard extends StatelessWidget {
  const _ChannelCard({
    required this.title,
    required this.subtitle,
    required this.connected,
    required this.icon,
    this.onConfigure,
  });

  final String title;
  final String subtitle;
  final bool connected;
  final IconData icon;
  final VoidCallback? onConfigure;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final statusColor = connected
        ? const Color(0xFF22C55E).withValues(alpha: 0.90)
        : theme.colorScheme.onSurface.withValues(alpha: 0.55);

    return ExecutiveGlassCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: theme.colorScheme.surface.withValues(alpha: 0.16),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
              ),
            ),
            child: Icon(icon, color: Colors.white.withValues(alpha: 0.86), size: 22),
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
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.92),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: statusColor.withValues(alpha: 0.14),
                        border: Border.all(color: statusColor.withValues(alpha: 0.25)),
                      ),
                      child: Text(
                        connected ? 'Conectado' : 'No conectado',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: statusColor,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.64),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          OutlinedButton.icon(
            onPressed: onConfigure,
            icon: const Icon(Icons.settings_outlined),
            label: const Text('Configurar'),
          ),
        ],
      ),
    );
  }
}
