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
    return LayoutBuilder(
      builder: (context, constraints) {
        const outerPadding = 24.0;
        final innerMaxWidth = math.max(0.0, constraints.maxWidth - outerPadding * 2);
        final innerMaxHeight =
            math.max(0.0, constraints.maxHeight - outerPadding * 2);

        final contentWidth = math.min(1400.0, innerMaxWidth);
        return Padding(
          padding: const EdgeInsets.all(outerPadding),
          child: Align(
            alignment: Alignment.topCenter,
            child: SizedBox(
              width: contentWidth,
              height: innerMaxHeight,
              child: child,
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

    final baseBorder = theme.colorScheme.outlineVariant.withValues(alpha: 0.55);
    final hoverBorder = theme.colorScheme.primary.withValues(alpha: 0.45);

    final background = theme.colorScheme.surface.withValues(alpha: 0.20);

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: _isHovered ? hoverBorder : baseBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _isHovered ? 0.22 : 0.18),
              blurRadius: _isHovered ? 26 : 20,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: background,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    theme.colorScheme.surface.withValues(alpha: 0.26),
                    theme.colorScheme.surface.withValues(alpha: 0.16),
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
      ),
    );
  }
}
