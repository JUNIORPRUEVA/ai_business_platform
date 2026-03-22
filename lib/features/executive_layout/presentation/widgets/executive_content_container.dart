import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

class ExecutiveContentContainer extends StatelessWidget {
  const ExecutiveContentContainer({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final outerPadding = width < 760 ? 12.0 : 22.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final innerMaxWidth =
            math.max(0.0, constraints.maxWidth - outerPadding * 2);
        final innerMaxHeight =
            math.max(0.0, constraints.maxHeight - outerPadding * 2);

        final contentWidth = math.min(1460.0, innerMaxWidth);
        return Padding(
          padding: EdgeInsets.all(outerPadding),
          child: Align(
            alignment: Alignment.topCenter,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color:
                      theme.colorScheme.outlineVariant.withValues(alpha: 0.86),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x120F172A),
                    blurRadius: 34,
                    offset: Offset(0, 20),
                  ),
                ],
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFFFFEFB),
                    Color(0xFFF8F3EA),
                    Color(0xFFF1E8DC),
                  ],
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: SizedBox(
                  width: contentWidth,
                  height: innerMaxHeight,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface.withValues(alpha: 0.94),
                    ),
                    child: child,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class ExecutiveGlassCard extends StatefulWidget {
  const ExecutiveGlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  State<ExecutiveGlassCard> createState() => _ExecutiveGlassCardState();
}

class _ExecutiveGlassCardState extends State<ExecutiveGlassCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final baseBorder = theme.colorScheme.outlineVariant.withValues(alpha: 0.7);
    final hoverBorder = theme.colorScheme.primary.withValues(alpha: 0.28);

    final background = theme.colorScheme.surface;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _isHovered ? hoverBorder : baseBorder),
          boxShadow: [
            BoxShadow(
              color: const Color(0x120F172A)
                  .withValues(alpha: _isHovered ? 1 : 0.84),
              blurRadius: _isHovered ? 32 : 24,
              offset: const Offset(0, 16),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: background,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  theme.colorScheme.surface,
                  theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.35),
                ],
              ),
            ),
            child: Padding(
              padding: widget.padding,
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}
