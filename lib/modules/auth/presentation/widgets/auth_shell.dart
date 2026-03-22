import 'package:flutter/material.dart';

import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.footer,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Stack(
        children: [
          const _AuthBackground(),
          SafeArea(
            child: ExecutiveContentContainer(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      color: theme.colorScheme.surface.withValues(alpha: 0.96),
                      border: Border.all(
                        color: theme.colorScheme.outlineVariant
                            .withValues(alpha: 0.9),
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x140F172A),
                          blurRadius: 34,
                          offset: Offset(0, 20),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color(0xFF0B6E61),
                                Color(0xFF2E6F95),
                              ],
                            ),
                          ),
                          child: const Icon(
                            Icons.auto_awesome_rounded,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 22),
                        Text(
                          title,
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          subtitle,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.70),
                          ),
                        ),
                        const SizedBox(height: 24),
                        child,
                        if (footer != null) ...[
                          const SizedBox(height: 18),
                          footer!,
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthBackground extends StatelessWidget {
  const _AuthBackground();

  @override
  Widget build(BuildContext context) {
    return const Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFF6F2E9),
              Color(0xFFF2EBE0),
              Color(0xFFE8DFD2),
            ],
          ),
        ),
        child: Stack(
          children: [
            _Orb(alignment: Alignment.topLeft, color: Color(0xFF7AB6A0)),
            _Orb(alignment: Alignment.bottomRight, color: Color(0xFFC8A47A)),
          ],
        ),
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.alignment, required this.color});

  final Alignment alignment;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: FractionallySizedBox(
        widthFactor: 0.6,
        heightFactor: 0.6,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: 0.24),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
