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
                'Activa los canales de atención de forma clara y ordenada. WhatsApp Evolution es el acceso principal para comenzar.',
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(20),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 920;
                final secondaryWidth = compact
                    ? double.infinity
                    : (constraints.maxWidth - 14 - 340)
                        .clamp(220.0, double.infinity);

                return Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    Container(
                      width: compact ? double.infinity : 340,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0x1A2DD4BF),
                            Color(0x1228C76F),
                          ],
                        ),
                        border: Border.all(
                          color: const Color(0x332DD4BF),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              color: const Color(0xFF2DD4BF)
                                  .withValues(alpha: 0.14),
                            ),
                            child: Text(
                              'Recomendado para empezar',
                              style: theme.textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF2DD4BF),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'WhatsApp como canal principal',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Preparamos una experiencia simple para tu cliente: crear la instancia, escanear el QR y comenzar a operar sin pasos innecesarios.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.72),
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: secondaryWidth,
                      child: Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: const [
                          _ChannelHighlight(
                            icon: Icons.rocket_launch_outlined,
                            title: 'Implementación guiada',
                            subtitle:
                                'La conexión de WhatsApp quedó enfocada en un flujo comprensible para cualquier cliente.',
                          ),
                          _ChannelHighlight(
                            icon: Icons.qr_code_2_rounded,
                            title: 'QR más visible',
                            subtitle:
                                'La pantalla prioriza el código QR con mayor tamaño y vista ampliada.',
                          ),
                          _ChannelHighlight(
                            icon: Icons.workspace_premium_outlined,
                            title: 'Imagen profesional',
                            subtitle:
                                'La interfaz usa mensajes claros y acciones simples, sin exponer complejidad técnica.',
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
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
                  subtitle: 'Canal principal con conexión guiada por QR',
                  connected: true,
                  icon: Icons.chat_rounded,
                  isPrimary: true,
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
    this.isPrimary = false,
    this.onConfigure,
  });

  final String title;
  final String subtitle;
  final bool connected;
  final IconData icon;
  final bool isPrimary;
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: isPrimary
                  ? const Color(0xFF25D366).withValues(alpha: 0.14)
                  : theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.42),
              border: Border.all(
                color: isPrimary
                    ? const Color(0xFF25D366).withValues(alpha: 0.26)
                    : theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
              ),
            ),
            child: Icon(
              icon,
              color: isPrimary
                  ? const Color(0xFF25D366)
                  : theme.colorScheme.primary,
              size: 22,
            ),
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
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.92),
                        ),
                      ),
                    ),
                    if (isPrimary) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color:
                              const Color(0xFF25D366).withValues(alpha: 0.12),
                        ),
                        child: Text(
                          'Principal',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: const Color(0xFF25D366),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: statusColor.withValues(alpha: 0.14),
                        border: Border.all(
                            color: statusColor.withValues(alpha: 0.25)),
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

class _ChannelHighlight extends StatelessWidget {
  const _ChannelHighlight({
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

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 180, maxWidth: 230),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: theme.colorScheme.surface.withValues(alpha: 0.10),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.50),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: theme.colorScheme.primary,
              size: 18,
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.66),
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
