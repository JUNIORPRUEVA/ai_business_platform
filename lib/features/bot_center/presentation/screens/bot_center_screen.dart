import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../modules/auth/application/auth_providers.dart';
import '../controllers/bot_center_controller.dart';
import '../widgets/bot_context_column.dart';
import '../widgets/bot_sidebar.dart';
import '../widgets/chat_workspace_panel.dart';

class BotCenterScreen extends StatefulWidget {
  const BotCenterScreen({super.key, this.onOpenSettings});

  final VoidCallback? onOpenSettings;

  @override
  State<BotCenterScreen> createState() => _BotCenterScreenState();
}

class _BotCenterScreenState extends State<BotCenterScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BotCenterModule(
        embedded: false,
        onOpenSettings: widget.onOpenSettings,
      ),
    );
  }
}

class BotCenterModule extends ConsumerStatefulWidget {
  const BotCenterModule({
    super.key,
    required this.embedded,
    this.onOpenSettings,
  });

  final bool embedded;
  final VoidCallback? onOpenSettings;

  @override
  ConsumerState<BotCenterModule> createState() => _BotCenterModuleState();
}

class _BotCenterModuleState extends ConsumerState<BotCenterModule> {
  late final BotCenterController _controller;

  @override
  void initState() {
    super.initState();
    _controller = BotCenterController.createDefault(
      tokenReader: () => ref.read(authTokenStoreProvider).read(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _controller.loadInitialData();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final actionMessage = _controller.actionMessage;

        if (actionMessage != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!context.mounted) {
              return;
            }

            ScaffoldMessenger.maybeOf(context)?.showSnackBar(
              SnackBar(content: Text(actionMessage)),
            );
            _controller.clearActionMessage();
          });
        }

        return BotCenterContent(
          controller: _controller,
          onOpenSettings: widget.onOpenSettings,
          embedded: widget.embedded,
        );
      },
    );
  }
}

class BotCenterContent extends StatefulWidget {
  const BotCenterContent({
    super.key,
    required this.controller,
    this.onOpenSettings,
    this.embedded = false,
  });

  final BotCenterController controller;
  final VoidCallback? onOpenSettings;
  final bool embedded;

  @override
  State<BotCenterContent> createState() => _BotCenterContentState();
}

class _BotCenterContentState extends State<BotCenterContent> {
  bool _isContextExpanded = false;
  final ScrollController _horizontalScrollController = ScrollController();

  @override
  void dispose() {
    _horizontalScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseLightTheme = AppTheme.light();
    final messagesTheme = baseLightTheme.copyWith(
      textTheme: baseLightTheme.textTheme.apply(fontFamily: 'Inter'),
      primaryTextTheme:
          baseLightTheme.primaryTextTheme.apply(fontFamily: 'Inter'),
    );

    final content = Theme(
      data: messagesTheme,
      child: Container(
        decoration: widget.embedded
            ? null
            : const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFF8FAFC),
                    Color(0xFFEEF2F7),
                  ],
                ),
              ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final contentPadding = widget.embedded
                ? EdgeInsets.zero
              : const EdgeInsets.fromLTRB(6, 0, 6, 4);

            // Spec: | Chats | Conversación | Contexto |
            final isWideDesktop = constraints.maxWidth >= 1320;
            final chatsWidth = isWideDesktop ? 272.0 : 284.0;
            final contextWidth = isWideDesktop ? 308.0 : 320.0;
            const columnGap = 8.0;
            const minConversationWidth = 640.0;

            final contextActualWidth = _isContextExpanded ? contextWidth : 0.0;

            final fixed = chatsWidth + contextActualWidth + (_isContextExpanded ? columnGap * 2 : columnGap);
            final availableConversationWidth = constraints.maxWidth - fixed;
            final needsHorizontalScroll =
                availableConversationWidth < minConversationWidth;

            final row = Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                    width: chatsWidth,
                    child: BotSidebar(controller: widget.controller)),
                const SizedBox(width: columnGap),
                if (needsHorizontalScroll)
                  SizedBox(
                    width: minConversationWidth,
                    child: ChatWorkspacePanel(
                      controller: widget.controller,
                      isContextExpanded: _isContextExpanded,
                      onToggleContext: () {
                        setState(() => _isContextExpanded = !_isContextExpanded);
                      },
                    ),
                  )
                else
                  Expanded(
                    child: ChatWorkspacePanel(
                      controller: widget.controller,
                      isContextExpanded: _isContextExpanded,
                      onToggleContext: () {
                        setState(() => _isContextExpanded = !_isContextExpanded);
                      },
                    ),
                  ),
                if (_isContextExpanded) ...[
                  const SizedBox(width: columnGap),
                  SizedBox(
                    width: contextActualWidth,
                    child: BotContextColumn(
                      controller: widget.controller,
                      onCollapse: () {
                        setState(() => _isContextExpanded = false);
                      },
                    ),
                  ),
                ],
              ],
            );

            return Padding(
              padding: contentPadding,
              child: Stack(
                children: [
                  Column(
                    children: [
                      if (widget.controller.errorMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _InlineBanner(
                            message: widget.controller.errorMessage!,
                            tone: _BannerTone.error,
                          ),
                        ),
                      Expanded(
                        child: needsHorizontalScroll
                            ? Scrollbar(
                                controller: _horizontalScrollController,
                                child: SingleChildScrollView(
                                  controller: _horizontalScrollController,
                                  scrollDirection: Axis.horizontal,
                                  child: SizedBox(
                                    width: fixed + minConversationWidth,
                                    child: row,
                                  ),
                                ),
                              )
                            : row,
                      ),
                    ],
                  ),
                  if (widget.controller.isInitialLoading &&
                      !widget.controller.hasLoaded)
                    const Positioned.fill(
                      child: _FullScreenLoader(),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );

    if (widget.embedded) {
      return content;
    }

    return SafeArea(child: content);
  }
}

class _ContextCollapsedRail extends StatelessWidget {
  const _ContextCollapsedRail({required this.onExpand});

  final VoidCallback onExpand;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Center(
        child: IconButton(
          tooltip: 'Mostrar contexto',
          onPressed: onExpand,
          icon: const Icon(Icons.chevron_left_rounded),
        ),
      ),
    );
  }
}

class _FullScreenLoader extends StatelessWidget {
  const _FullScreenLoader();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0x99F8FAFC),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x140F172A),
                blurRadius: 24,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 30,
                height: 30,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
              SizedBox(height: 14),
              Text('Cargando conversaciones'),
            ],
          ),
        ),
      ),
    );
  }
}

enum _BannerTone { error }

class _InlineBanner extends StatelessWidget {
  const _InlineBanner({
    required this.message,
    required this.tone,
  });

  final String message;
  final _BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final isError = tone == _BannerTone.error;
    final background =
        isError ? const Color(0xFFFEECEC) : const Color(0xFFEFF4FF);
    final foreground =
        isError ? const Color(0xFFB42318) : const Color(0xFF165DFF);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: foreground.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline_rounded : Icons.info_outline_rounded,
            color: foreground,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: foreground),
            ),
          ),
        ],
      ),
    );
  }
}
