import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../application/executive_navigation_provider.dart';
import 'executive_app_bar.dart';
import 'executive_content_container.dart';
import 'executive_footer.dart';
import 'executive_nav_item.dart';
import 'executive_sidebar.dart';

class ExecutiveLayout extends ConsumerStatefulWidget {
  const ExecutiveLayout({
    super.key,
    required this.title,
    required this.items,
    required this.builder,
    this.initialIndex = 0,
  });

  final String title;
  final List<ExecutiveNavItem> items;
  final int initialIndex;
  final Widget Function(BuildContext context, int selectedIndex) builder;

  @override
  ConsumerState<ExecutiveLayout> createState() => _ExecutiveLayoutState();
}

class _ExecutiveLayoutState extends ConsumerState<ExecutiveLayout> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  bool _isSidebarCollapsed = false;
  bool _didAutoCollapseOnce = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      ref.read(executiveSelectedIndexProvider.notifier).state =
          widget.initialIndex;
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final rawSelectedIndex = ref.watch(executiveSelectedIndexProvider);
    final selectedIndex = rawSelectedIndex.clamp(0, widget.items.length - 1);
    const useWhatsappShell = true;

    final isMobile = size.width < 760;
    final isNarrow = size.width >= 760 && size.width < 1100;

    if (rawSelectedIndex != selectedIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        ref.read(executiveSelectedIndexProvider.notifier).state = selectedIndex;
      });
    }

    final pageTitle = _pageTitleForIndex(selectedIndex);
    final isMessagesPage = pageTitle.toLowerCase().contains('mensajes');

    if (!_didAutoCollapseOnce && isNarrow) {
      _didAutoCollapseOnce = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        setState(() => _isSidebarCollapsed = true);
      });
    }

    final baseLightTheme = AppTheme.light();
    final messagesTheme = baseLightTheme.copyWith(
      textTheme: baseLightTheme.textTheme.apply(fontFamily: 'Inter'),
      primaryTextTheme:
          baseLightTheme.primaryTextTheme.apply(fontFamily: 'Inter'),
    );

    return Scaffold(
      key: _scaffoldKey,
      drawer: isMobile
          ? Drawer(
              width: useWhatsappShell
                  ? ExecutiveSidebar.whatsappRailWidth
                  : ExecutiveSidebar.expandedWidth,
              backgroundColor: Colors.transparent,
              child: SafeArea(
                child: ExecutiveSidebar(
                  items: widget.items,
                  selectedIndex: selectedIndex,
                  whatsappStyle: useWhatsappShell,
                  isCollapsed: false,
                  onSelect: (index) {
                    ref.read(executiveSelectedIndexProvider.notifier).state =
                        index;
                    Navigator.of(context).maybePop();
                  },
                  onToggleCollapse: () {},
                ),
              ),
            )
          : null,
      body: Stack(
        children: [
          if (useWhatsappShell)
            const _ExecutiveLightBackground()
          else
            const _ExecutiveBackground(),
          Theme(
            data: useWhatsappShell ? messagesTheme : Theme.of(context),
            child: SafeArea(
              child: Row(
                children: [
                  if (!isMobile)
                    ExecutiveSidebar(
                      items: widget.items,
                      selectedIndex: selectedIndex,
                      whatsappStyle: useWhatsappShell,
                      isCollapsed: _isSidebarCollapsed,
                      onSelect: (index) {
                        ref
                            .read(executiveSelectedIndexProvider.notifier)
                            .state = index;
                      },
                      onToggleCollapse: () {
                        setState(
                            () => _isSidebarCollapsed = !_isSidebarCollapsed);
                      },
                    ),
                  Expanded(
                    child: Column(
                      children: [
                        ExecutiveAppBar(
                          title: pageTitle,
                          height: useWhatsappShell ? 58 : 70,
                          minimal: useWhatsappShell,
                          whatsappStyle: useWhatsappShell,
                          onToggleSidebar: () {
                            if (isMobile) {
                              _scaffoldKey.currentState?.openDrawer();
                              return;
                            }
                            setState(() =>
                                _isSidebarCollapsed = !_isSidebarCollapsed);
                          },
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              Expanded(
                                child: isMessagesPage
                                    ? Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          10,
                                          2,
                                          10,
                                          0,
                                        ),
                                        child: widget.builder(
                                            context, selectedIndex),
                                      )
                                    : ExecutiveContentContainer(
                                        child: widget.builder(
                                            context, selectedIndex),
                                      ),
                              ),
                              const SizedBox(height: 8),
                              if (useWhatsappShell)
                                const _FooterFullWidth(whatsappStyle: true)
                              else
                                const _FooterMaxWidth(),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _pageTitleForIndex(int index) {
    if (index < 0 || index >= widget.items.length) {
      return widget.title;
    }
    return widget.items[index].label;
  }
}

class _FooterMaxWidth extends StatelessWidget {
  const _FooterMaxWidth();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1400),
        child: Padding(
          padding: const EdgeInsets.only(left: 24, right: 24, bottom: 16),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: const ExecutiveFooter(height: 50),
          ),
        ),
      ),
    );
  }
}

class _FooterFullWidth extends StatelessWidget {
  const _FooterFullWidth({this.whatsappStyle = false});

  final bool whatsappStyle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: ExecutiveFooter(
            height: whatsappStyle ? 38 : 50, whatsappStyle: whatsappStyle),
      ),
    );
  }
}

class _ExecutiveBackground extends StatelessWidget {
  const _ExecutiveBackground();

  @override
  Widget build(BuildContext context) {
    return const Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF182A4D),
              Color(0xFF13244A),
              Color(0xFF0B1024),
            ],
          ),
        ),
        child: Stack(
          children: [
            _RadialGlow(
              alignment: Alignment.topLeft,
              color: Color(0xFF38BDF8),
              opacity: 0.26,
              radius: 0.75,
            ),
            _RadialGlow(
              alignment: Alignment.topRight,
              color: Color(0xFF60A5FA),
              opacity: 0.22,
              radius: 0.70,
            ),
            _RadialGlow(
              alignment: Alignment.bottomLeft,
              color: Color(0xFF22C55E),
              opacity: 0.12,
              radius: 0.80,
            ),
          ],
        ),
      ),
    );
  }
}

class _ExecutiveLightBackground extends StatelessWidget {
  const _ExecutiveLightBackground();

  @override
  Widget build(BuildContext context) {
    return const Positioned.fill(
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFF0F3EA),
                  Color(0xFFE7ECE3),
                  Color(0xFFDCE4DD),
                ],
                stops: [0, 0.48, 1],
              ),
            ),
          ),
          _RadialGlow(
            alignment: Alignment.topLeft,
            color: Color(0xFF8DB7AB),
            opacity: 0.16,
            radius: 0.88,
          ),
          _RadialGlow(
            alignment: Alignment.topRight,
            color: Color(0xFFB0B89A),
            opacity: 0.12,
            radius: 0.74,
          ),
          _RadialGlow(
            alignment: Alignment.bottomCenter,
            color: Color(0xFFDEE7D4),
            opacity: 0.22,
            radius: 1.10,
          ),
        ],
      ),
    );
  }
}

class _RadialGlow extends StatelessWidget {
  const _RadialGlow({
    required this.alignment,
    required this.color,
    required this.opacity,
    required this.radius,
  });

  final Alignment alignment;
  final Color color;
  final double opacity;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: FractionallySizedBox(
        widthFactor: radius,
        heightFactor: radius,
        child: IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [
                  color.withValues(alpha: opacity),
                  color.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
