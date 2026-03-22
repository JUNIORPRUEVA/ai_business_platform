import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class UsersRolesScreen extends StatelessWidget {
  const UsersRolesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Usuarios y roles',
            subtitle:
                'Administra miembros del equipo y permisos (Administrador, Agente, Gerente, Técnico, Ventas).',
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 960;

              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  for (final item in const [
                    ('Miembros activos', '12'),
                    ('Administradores', '3'),
                    ('Agentes', '6'),
                  ])
                    SizedBox(
                      width: compact
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 28) / 3,
                      child: ExecutiveGlassCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.$1, style: theme.textTheme.bodySmall),
                            const SizedBox(height: 10),
                            Text(
                              item.$2,
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontSize: 24),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Miembros del equipo',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                      label: const Text('Invitar'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const _UserRow(
                  name: 'Administrador ejecutivo',
                  email: 'admin@fulltech.com',
                  role: 'Administrador',
                ),
                const SizedBox(height: 10),
                const _UserRow(
                  name: 'Agente de soporte',
                  email: 'agent@fulltech.com',
                  role: 'Agente',
                ),
                const SizedBox(height: 10),
                const _UserRow(
                  name: 'Gerente de ventas',
                  email: 'sales@fulltech.com',
                  role: 'Gerente',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _UserRow extends StatelessWidget {
  const _UserRow({
    required this.name,
    required this.email,
    required this.role,
  });

  final String name;
  final String email;
  final String role;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.18),
          child: Text(
            name.isNotEmpty ? name.characters.first.toUpperCase() : '?',
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w900,
              color: theme.colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.90),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                email,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.62),
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            color: theme.colorScheme.surface.withValues(alpha: 0.16),
            border: Border.all(
              color: theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
            ),
          ),
          child: Text(
            role,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.82),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 10),
        OutlinedButton(onPressed: () {}, child: const Text('Administrar')),
      ],
    );
  }
}
