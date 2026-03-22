import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/executive_navigation_provider.dart';
import '../../../../modules/auth/application/auth_providers.dart';
import '../../../../modules/tenancy/application/tenancy_providers.dart';
import 'user_profile_dialog.dart';

class ExecutiveAppBar extends ConsumerWidget {
  const ExecutiveAppBar({
    super.key,
    required this.title,
    required this.onToggleSidebar,
    this.height = 70,
    this.minimal = false,
    this.whatsappStyle = false,
  });

  final String title;
  final VoidCallback onToggleSidebar;
  final double height;
  final bool minimal;
  final bool whatsappStyle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (whatsappStyle) {
      return _WhatsappExecutiveAppBar(
        title: title,
        height: height,
        onToggleSidebar: onToggleSidebar,
      );
    }

    final theme = Theme.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 760;
    final isTiny = width < 380;
    final isCompact = width < 900;
    final searchWidth =
        math.min(360.0, math.max(220.0, width * 0.32)).toDouble();
    final horizontalPadding = isMobile ? 12.0 : 18.0;
    final iconSize = isTiny ? 38.0 : (isMobile ? 40.0 : 44.0);
    final iconGap = isMobile ? 6.0 : 8.0;

    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface.withValues(alpha: 0.78),
          border: Border(
            bottom: BorderSide(
              color: theme.colorScheme.outlineVariant.withValues(alpha: 0.78),
            ),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0E0F172A),
              blurRadius: 18,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: Row(
            children: [
              if (!minimal || isMobile) ...[
                _HoverIconButton(
                  icon: Icons.menu_rounded,
                  tooltip: 'Alternar navegación',
                  onPressed: onToggleSidebar,
                  size: iconSize,
                ),
                const SizedBox(width: 14),
              ],
              if (minimal) ...[
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.9),
                    ),
                  ),
                ),
                _HoverIconButton(
                  icon: Icons.search_rounded,
                  tooltip: 'Buscar',
                  onPressed: () {},
                  size: iconSize,
                ),
                SizedBox(width: iconGap),
                _HoverIconButton(
                  icon: Icons.notifications_none_rounded,
                  tooltip: 'Notificaciones',
                  onPressed: () {},
                  size: iconSize,
                ),
                SizedBox(width: isMobile ? 8 : 12),
                _UserMenu(isCompact: true, isMobile: isMobile),
              ] else ...[
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Enterprise workspace',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontSize: isMobile ? 20 : 22,
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isMobile) ...[
                  const SizedBox(width: 10),
                  _TenantSwitcher(isCompact: isCompact),
                  const SizedBox(width: 12),
                ],
                if (isMobile) ...[
                  _HoverIconButton(
                    icon: Icons.search_rounded,
                    tooltip: 'Buscar',
                    onPressed: () {},
                    size: iconSize,
                  ),
                  SizedBox(width: iconGap),
                ] else ...[
                  SizedBox(
                    width: isCompact
                        ? math
                            .min(260.0, math.max(180.0, width * 0.3))
                            .toDouble()
                        : searchWidth,
                    child: const _SearchField(),
                  ),
                  SizedBox(width: isCompact ? 8 : 12),
                ],
                _HoverIconButton(
                  icon: Icons.notifications_none_rounded,
                  tooltip: 'Notificaciones',
                  onPressed: () {},
                  size: iconSize,
                ),
                SizedBox(width: iconGap),
                _HoverIconButton(
                  icon: Icons.chat_bubble_outline_rounded,
                  tooltip: 'Mensajes',
                  onPressed: () {
                    ref.read(executiveSelectedIndexProvider.notifier).state =
                        executiveMessagesIndex;
                  },
                  size: iconSize,
                ),
                SizedBox(width: isMobile ? 8 : 12),
                _UserMenu(isCompact: isCompact, isMobile: isMobile),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _WhatsappExecutiveAppBar extends ConsumerWidget {
  const _WhatsappExecutiveAppBar({
    required this.title,
    required this.height,
    required this.onToggleSidebar,
  });

  final String title;
  final double height;
  final VoidCallback onToggleSidebar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 760;
    final authState = ref.watch(authControllerProvider);
    final tenant = ref.watch(selectedTenantProvider);
    final userName = authState.session?.user.name ?? 'Usuario';
    final companyName = authState.session?.company.name ?? tenant.name;
    final avatarUrl = authState.session?.user.avatarUrl;

    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF0F2F5),
          border: Border(
            bottom: BorderSide(color: Color(0xFFDADDE1)),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: isMobile ? 10 : 14),
          child: Row(
            children: [
              if (isMobile) ...[
                _HoverIconButton(
                  icon: Icons.menu_rounded,
                  tooltip: 'Abrir navegación',
                  onPressed: onToggleSidebar,
                  size: 40,
                ),
                const SizedBox(width: 8),
              ],
              CircleAvatar(
                radius: 19,
                backgroundColor: const Color(0xFFDDE6EA),
                foregroundImage:
                    avatarUrl != null && avatarUrl.trim().isNotEmpty
                        ? NetworkImage(avatarUrl.trim())
                        : null,
                child: Text(
                  companyName.characters.first.toUpperCase(),
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: const Color(0xFF111B21),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      companyName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF111B21),
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '${tenant.name} • $userName',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontSize: 11.5,
                        color: const Color(0xFF667781),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                title,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: const Color(0xFF667781),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              _HoverIconButton(
                icon: Icons.content_copy_outlined,
                tooltip: 'Copiar información',
                onPressed: () {},
                size: 40,
              ),
              const SizedBox(width: 2),
              _HoverIconButton(
                icon: Icons.search_rounded,
                tooltip: 'Buscar',
                onPressed: () {},
                size: 40,
              ),
              const SizedBox(width: 4),
              _HoverIconButton(
                icon: Icons.more_vert_rounded,
                tooltip: 'Más opciones',
                onPressed: () {
                  ref.read(executiveSelectedIndexProvider.notifier).state =
                      executiveSettingsIndex;
                },
                size: 40,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TenantSwitcher extends ConsumerStatefulWidget {
  const _TenantSwitcher({required this.isCompact});

  final bool isCompact;

  @override
  ConsumerState<_TenantSwitcher> createState() => _TenantSwitcherState();
}

class _TenantSwitcherState extends ConsumerState<_TenantSwitcher> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tenant = ref.watch(selectedTenantProvider);
    final tenants = ref.watch(tenantsProvider);

    return MenuAnchor(
      builder: (context, controller, child) {
        return MouseRegion(
          onEnter: (_) => setState(() => _isHovered = true),
          onExit: (_) => setState(() => _isHovered = false),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () {
              if (tenants.length == 1) {
                ref.read(executiveSelectedIndexProvider.notifier).state =
                    executiveSettingsIndex;
                return;
              }
              controller.isOpen ? controller.close() : controller.open();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: _isHovered ? 0.9 : 0.65),
                border: Border.all(
                  color: (_isHovered
                          ? theme.colorScheme.primary.withValues(alpha: 0.35)
                          : theme.colorScheme.outlineVariant
                              .withValues(alpha: 0.55))
                      .withValues(alpha: 1),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          theme.colorScheme.primary.withValues(alpha: 0.85),
                          theme.colorScheme.secondary.withValues(alpha: 0.65),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color:
                              theme.colorScheme.primary.withValues(alpha: 0.18),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.apartment_rounded,
                        size: 18, color: Colors.white),
                  ),
                  if (!widget.isCompact) ...[
                    const SizedBox(width: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 240),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            tenant.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.92),
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            '${tenant.planLabel} • ${tenant.industryLabel}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.65),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    const SizedBox(width: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 160),
                      child: Text(
                        tenant.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.90),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      menuChildren: [
        for (final t in tenants)
          MenuItemButton(
            leadingIcon: const Icon(Icons.apartment_rounded),
            child: Text(t.name),
            onPressed: () {
              ref.read(selectedTenantIdProvider.notifier).state = t.id;
            },
          ),
      ],
    );
  }
}

class _SearchField extends StatefulWidget {
  const _SearchField();

  @override
  State<_SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<_SearchField> {
  bool _isHovered = false;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: theme.colorScheme.surfaceContainerHighest
              .withValues(alpha: _isHovered ? 0.92 : 0.68),
          border: Border.all(
            color: (_isHovered
                    ? theme.colorScheme.primary.withValues(alpha: 0.35)
                    : theme.colorScheme.outlineVariant.withValues(alpha: 0.55))
                .withValues(alpha: 1),
          ),
        ),
        child: TextField(
          controller: _controller,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontSize: 14,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.88),
          ),
          decoration: InputDecoration(
            hintText: 'Buscar…',
            hintStyle: theme.textTheme.bodyMedium?.copyWith(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.55),
            ),
            prefixIcon: Icon(
              Icons.search_rounded,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.60),
            ),
            border: InputBorder.none,
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          ),
        ),
      ),
    );
  }
}

class _UserMenu extends ConsumerStatefulWidget {
  const _UserMenu({required this.isCompact, required this.isMobile});

  final bool isCompact;
  final bool isMobile;

  @override
  ConsumerState<_UserMenu> createState() => _UserMenuState();
}

class _UserMenuState extends ConsumerState<_UserMenu> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authState = ref.watch(authControllerProvider);
    final userName = authState.session?.user.name ?? 'Ejecutivo';
    final companyName = authState.session?.company.name ?? 'Empresa';
    final avatarUrl = authState.session?.user.avatarUrl;

    return MenuAnchor(
      builder: (context, controller, child) {
        return MouseRegion(
          onEnter: (_) => setState(() => _isHovered = true),
          onExit: (_) => setState(() => _isHovered = false),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: controller.isOpen ? controller.close : controller.open,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.symmetric(
                horizontal: widget.isMobile ? 8 : 10,
                vertical: widget.isMobile ? 7 : 8,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: theme.colorScheme.surfaceContainerHighest
                    .withValues(alpha: _isHovered ? 0.92 : 0.68),
                border: Border.all(
                  color:
                      theme.colorScheme.outlineVariant.withValues(alpha: 0.55),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Avatar(avatarUrl: avatarUrl, userName: userName),
                  if (!widget.isCompact) ...[
                    const SizedBox(width: 10),
                    Text(
                      userName,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color:
                            theme.colorScheme.onSurface.withValues(alpha: 0.90),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.70),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      menuChildren: [
        MenuItemButton(
          leadingIcon: const Icon(Icons.person_outline_rounded),
          child: Text(userName),
          onPressed: () async {
            await showDialog<void>(
              context: context,
              builder: (dialogContext) => const UserProfileDialog(),
            );
          },
        ),
        MenuItemButton(
          leadingIcon: const Icon(Icons.business_outlined),
          child: Text(companyName),
          onPressed: () {
            ref.read(executiveSelectedIndexProvider.notifier).state =
                executiveSettingsIndex;
          },
        ),
        MenuItemButton(
          leadingIcon: const Icon(Icons.settings_outlined),
          child: const Text('Configuración'),
          onPressed: () {
            ref.read(executiveSelectedIndexProvider.notifier).state =
                executiveSettingsIndex;
          },
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Divider(height: 1),
        ),
        MenuItemButton(
          leadingIcon: const Icon(Icons.logout_rounded),
          child: const Text('Cerrar sesión'),
          onPressed: () async {
            await ref.read(authControllerProvider.notifier).logout();
            if (!context.mounted) {
              return;
            }
            Navigator.of(context)
                .pushNamedAndRemoveUntil('/login', (_) => false);
          },
        ),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.userName, this.avatarUrl});

  final String userName;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = userName.trim().isEmpty
        ? 'U'
        : userName
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((part) => part.characters.first.toUpperCase())
            .join();

    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary.withValues(alpha: 0.95),
            const Color(0xFF38BDF8).withValues(alpha: 0.85),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.primary.withValues(alpha: 0.22),
            blurRadius: 16,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipOval(
        child: avatarUrl != null && avatarUrl!.isNotEmpty
            ? Image.network(
                avatarUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Center(
                    child: Text(
                      initials,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  );
                },
              )
            : Center(
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
      ),
    );
  }
}

class _HoverIconButton extends StatefulWidget {
  const _HoverIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.size = 44,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final double size;

  @override
  State<_HoverIconButton> createState() => _HoverIconButtonState();
}

class _HoverIconButtonState extends State<_HoverIconButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: widget.onPressed,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOutCubic,
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: theme.colorScheme.surfaceContainerHighest
                  .withValues(alpha: _isHovered ? 0.88 : 0.58),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.55),
              ),
            ),
            child: Icon(
              widget.icon,
              color: theme.colorScheme.onSurface
                  .withValues(alpha: _isHovered ? 0.90 : 0.72),
              size: widget.size * 0.50,
            ),
          ),
        ),
      ),
    );
  }
}
