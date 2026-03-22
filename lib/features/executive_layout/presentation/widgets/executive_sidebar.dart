import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../modules/auth/application/auth_providers.dart';
import '../../../../modules/tenancy/application/tenancy_providers.dart';
import 'executive_nav_item.dart';

class ExecutiveSidebar extends ConsumerWidget {
  const ExecutiveSidebar({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.isCollapsed,
    required this.onSelect,
    required this.onToggleCollapse,
    this.whatsappStyle = false,
  });

  final List<ExecutiveNavItem> items;
  final int selectedIndex;
  final bool isCollapsed;
  final ValueChanged<int> onSelect;
  final VoidCallback onToggleCollapse;
  final bool whatsappStyle;

  static const double expandedWidth = 260;
  static const double collapsedWidth = 80;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (whatsappStyle) {
      final authState = ref.watch(authControllerProvider);
      final tenant = ref.watch(selectedTenantProvider);
      final userName = authState.session?.user.name ?? 'Usuario';
      final companyName = authState.session?.company.name ?? tenant.name;
      final avatarUrl = authState.session?.user.avatarUrl;

      return _WhatsappSidebarRail(
        items: items,
        selectedIndex: selectedIndex,
        onSelect: onSelect,
        userName: userName,
        companyName: companyName,
        avatarUrl: avatarUrl,
      );
    }

    final theme = Theme.of(context);
    final width = isCollapsed ? collapsedWidth : expandedWidth;
    final shellPadding = EdgeInsets.all(isCollapsed ? 10 : 14);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      width: width,
      child: Padding(
        padding: shellPadding,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.30),
                blurRadius: 34,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(26),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF0B1A3A),
                      Color(0xFF10264D),
                      Color(0xFF0A0F24),
                    ],
                    stops: [0, 0.55, 1],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.10),
                  ),
                ),
                child: Column(
                  children: [
                    _SidebarHeader(
                      isCollapsed: isCollapsed,
                      onToggleCollapse: onToggleCollapse,
                    ),
                    const SizedBox(height: 10),
                    Expanded(
                      child: ListView.separated(
                        padding: EdgeInsets.symmetric(
                            horizontal: isCollapsed ? 6 : 8),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final item = items[index];
                          final isActive = selectedIndex == index;
                          return _SidebarItem(
                            label: item.label,
                            icon: item.icon,
                            isCollapsed: isCollapsed,
                            isActive: isActive,
                            onTap: () => onSelect(index),
                            activeColor: theme.colorScheme.primary,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
                      child: _SidebarFooterPill(isCollapsed: isCollapsed),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WhatsappSidebarRail extends StatelessWidget {
  const _WhatsappSidebarRail({
    required this.items,
    required this.selectedIndex,
    required this.onSelect,
    required this.userName,
    required this.companyName,
    required this.avatarUrl,
  });

  final List<ExecutiveNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final String userName;
  final String companyName;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF0F2F5),
          border: Border(
            right: BorderSide(color: Color(0xFFDADDE1)),
          ),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 10, 0, 6),
              child: Tooltip(
                message: companyName,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD9FDD3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.wechat_rounded,
                    color: Color(0xFF00A884),
                    size: 23,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 2),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 2),
                itemBuilder: (context, index) {
                  final item = items[index];
                  return _WhatsappRailItem(
                    item: item,
                    isActive: index == selectedIndex,
                    onTap: () => onSelect(index),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),
            Tooltip(
              message: 'Configuración',
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {},
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(
                      Icons.settings_outlined,
                      size: 22,
                      color: Color(0xFF54656F),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Tooltip(
              message: '$userName • $companyName',
              child: _WhatsappAvatarPill(
                userName: userName,
                avatarUrl: avatarUrl,
              ),
            ),
            const SizedBox(height: 14),
          ],
        ),
      ),
    );
  }
}

class _WhatsappRailItem extends StatelessWidget {
  const _WhatsappRailItem({
    required this.item,
    required this.isActive,
    required this.onTap,
  });

  final ExecutiveNavItem item;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: item.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            child: Center(
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color:
                      isActive ? const Color(0xFFD9FDD3) : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  item.icon,
                  size: 21,
                  color: isActive
                      ? const Color(0xFF111B21)
                      : const Color(0xFF54656F),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WhatsappAvatarPill extends StatelessWidget {
  const _WhatsappAvatarPill({
    required this.userName,
    required this.avatarUrl,
  });

  final String userName;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final initials = userName.trim().isEmpty
        ? 'U'
        : userName
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((part) => part.characters.first.toUpperCase())
            .join();

    return Stack(
      clipBehavior: Clip.none,
      children: [
        CircleAvatar(
          radius: 17,
          backgroundColor: const Color(0xFFDDE6EA),
          foregroundImage: avatarUrl != null && avatarUrl!.trim().isNotEmpty
              ? NetworkImage(avatarUrl!.trim())
              : null,
          child: Text(
            initials,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: const Color(0xFF111B21),
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        Positioned(
          right: -1,
          bottom: -1,
          child: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: const Color(0xFF25D366),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFF0F2F5), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class _SidebarHeader extends StatelessWidget {
  const _SidebarHeader({
    required this.isCollapsed,
    required this.onToggleCollapse,
  });

  final bool isCollapsed;
  final VoidCallback onToggleCollapse;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final logo = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary.withValues(alpha: 0.85),
            const Color(0xFF38BDF8).withValues(alpha: 0.75),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.primary.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: const Icon(Icons.auto_awesome_rounded, color: Colors.white),
    );

    if (isCollapsed) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(10, 14, 10, 8),
        child: Column(
          children: [
            logo,
            const SizedBox(height: 10),
            _HoverIconButton(
              icon: Icons.chevron_right_rounded,
              tooltip: 'Expandir barra lateral',
              onPressed: onToggleCollapse,
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
      child: Row(
        children: [
          logo,
          const SizedBox(width: 12),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeOutCubic,
              child: Column(
                key: const ValueKey('expanded_title'),
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'FULLTECH',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Consola ejecutiva',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.62),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
          _HoverIconButton(
            icon: Icons.chevron_left_rounded,
            tooltip: 'Contraer barra lateral',
            onPressed: onToggleCollapse,
          ),
        ],
      ),
    );
  }
}

class _SidebarItem extends StatefulWidget {
  const _SidebarItem({
    required this.label,
    required this.icon,
    required this.isCollapsed,
    required this.isActive,
    required this.onTap,
    required this.activeColor,
  });

  final String label;
  final IconData icon;
  final bool isCollapsed;
  final bool isActive;
  final VoidCallback onTap;
  final Color activeColor;

  @override
  State<_SidebarItem> createState() => _SidebarItemState();
}

class _SidebarItemState extends State<_SidebarItem> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final iconColor = widget.isActive
        ? Colors.white
        : Colors.white.withValues(alpha: _isHovered ? 0.90 : 0.72);
    final textColor = widget.isActive
        ? Colors.white.withValues(alpha: 0.92)
        : Colors.white.withValues(alpha: _isHovered ? 0.90 : 0.68);

    final background = widget.isActive
        ? Colors.white.withValues(alpha: 0.10)
        : _isHovered
            ? Colors.white.withValues(alpha: 0.07)
            : Colors.transparent;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            padding: EdgeInsets.symmetric(
              horizontal: widget.isCollapsed ? 0 : 14,
              vertical: widget.isCollapsed ? 10 : 12,
            ),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              color: background,
              border: Border.all(
                color: (widget.isActive
                        ? widget.activeColor.withValues(alpha: 0.32)
                        : Colors.white.withValues(alpha: 0.07))
                    .withValues(alpha: widget.isActive ? 1 : 1),
              ),
            ),
            child: widget.isCollapsed
                ? Stack(
                    children: [
                      Align(
                        alignment: Alignment.center,
                        child: AnimatedScale(
                          duration: const Duration(milliseconds: 140),
                          scale: _isHovered ? 1.04 : 1,
                          child: Icon(widget.icon, color: iconColor, size: 20),
                        ),
                      ),
                      if (widget.isActive)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            width: 4,
                            height: 22,
                            margin: const EdgeInsets.only(left: 6),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              color: widget.activeColor,
                            ),
                          ),
                        ),
                    ],
                  )
                : Row(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOutCubic,
                        width: 4,
                        height: 22,
                        margin: const EdgeInsets.only(right: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: widget.isActive
                              ? widget.activeColor
                              : Colors.transparent,
                        ),
                      ),
                      SizedBox(
                        width: 44,
                        child: Center(
                          child: AnimatedScale(
                            duration: const Duration(milliseconds: 140),
                            scale: _isHovered ? 1.04 : 1,
                            child:
                                Icon(widget.icon, color: iconColor, size: 20),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          widget.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: textColor,
                            fontSize: 14,
                            fontWeight: widget.isActive
                                ? FontWeight.w700
                                : FontWeight.w600,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _SidebarFooterPill extends StatelessWidget {
  const _SidebarFooterPill({required this.isCollapsed});

  final bool isCollapsed;

  @override
  Widget build(BuildContext context) {
    if (isCollapsed) {
      return const SizedBox(height: 0);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Colors.white.withValues(alpha: 0.06),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: Colors.white.withValues(alpha: 0.08),
            ),
            child: Icon(
              Icons.lock_outline_rounded,
              color: Colors.white.withValues(alpha: 0.86),
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Espacio de trabajo seguro',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.88),
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Controles de acceso de nivel empresarial.',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.62),
                    fontSize: 12,
                    height: 1.2,
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

class _HoverIconButton extends StatefulWidget {
  const _HoverIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  State<_HoverIconButton> createState() => _HoverIconButtonState();
}

class _HoverIconButtonState extends State<_HoverIconButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: widget.onPressed,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOutCubic,
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: Colors.white.withValues(alpha: _isHovered ? 0.10 : 0.06),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Icon(
              widget.icon,
              color: Colors.white.withValues(alpha: _isHovered ? 0.92 : 0.80),
            ),
          ),
        ),
      ),
    );
  }
}
