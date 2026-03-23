import 'package:flutter/material.dart';

import '../../../../features/bot_configuration_center/presentation/controllers/bot_configuration_center_controller.dart';
import '../../../../features/bot_configuration_center/presentation/widgets/configuration_sections.dart';
import '../../../../features/bot_configuration_center/presentation/widgets/configuration_shell_widgets.dart';

class PromptsKnowledgeScreen extends StatefulWidget {
  const PromptsKnowledgeScreen({super.key});

  @override
  State<PromptsKnowledgeScreen> createState() => _PromptsKnowledgeScreenState();
}

class _PromptsKnowledgeScreenState extends State<PromptsKnowledgeScreen> {
  late final BotConfigurationCenterController _controller;

  @override
  void initState() {
    super.initState();
    _controller = BotConfigurationCenterController();
    Future<void>.microtask(_controller.load);
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
        return DefaultTabController(
          length: 3,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final theme = Theme.of(context);

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _WorkspaceOverview(controller: _controller),
                  const SizedBox(height: 8),
                  if (_controller.successMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ConfigurationBanner(
                        message: _controller.successMessage!,
                        isError: false,
                        onDismiss: _controller.dismissBanners,
                      ),
                    ),
                  if (_controller.errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ConfigurationBanner(
                        message: _controller.errorMessage!,
                        isError: true,
                        onDismiss: _controller.dismissBanners,
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface.withValues(alpha: 0.84),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: theme.colorScheme.outlineVariant,
                      ),
                    ),
                    child: TabBar(
                      dividerColor: Colors.transparent,
                      isScrollable: constraints.maxWidth < 920,
                      tabAlignment: constraints.maxWidth < 920
                          ? TabAlignment.start
                          : TabAlignment.fill,
                      splashBorderRadius: BorderRadius.circular(10),
                      indicator: BoxDecoration(
                        color: theme.colorScheme.surface,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x120F172A),
                            blurRadius: 8,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      labelStyle: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                      unselectedLabelStyle:
                          theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      tabs: const [
                        Tab(
                          icon: Icon(Icons.edit_note_rounded),
                          text: 'Prompts',
                        ),
                        Tab(
                          icon: Icon(Icons.inventory_2_outlined),
                          text: 'Conocimiento',
                        ),
                        Tab(
                          icon: Icon(Icons.auto_awesome_rounded),
                          text: 'Motor de IA',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: _controller.isLoading
                        ? const Center(child: CircularProgressIndicator())
                        : TabBarView(
                            children: [
                              PromptsSettingsSection(controller: _controller),
                              DocumentsSettingsSection(controller: _controller),
                              OpenAiSettingsSection(controller: _controller),
                            ],
                          ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _WorkspaceOverview extends StatelessWidget {
  const _WorkspaceOverview({required this.controller});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 980) {
          return Column(
            children: [
              SizedBox(
                width: double.infinity,
                child: _WorkspaceMetricTile(
                  label: 'Prompt',
                  value: controller.bundle.prompts.isEmpty
                      ? 'Sin prompt'
                      : controller.bundle.prompts.first.title,
                  accent: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: _WorkspaceMetricTile(
                  label: 'Conocimiento',
                  value: '${controller.bundle.documents.length} archivos',
                  accent: const Color(0xFF0F766E),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: _WorkspaceMetricTile(
                  label: 'Motor de IA',
                  value: controller.bundle.openAi.isEnabled
                      ? controller.bundle.openAi.model
                      : 'Pausado',
                  accent: const Color(0xFF9A3412),
                ),
              ),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _WorkspaceMetricTile(
                label: 'Prompt',
                value: controller.bundle.prompts.isEmpty
                    ? 'Sin prompt'
                    : controller.bundle.prompts.first.title,
                accent: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _WorkspaceMetricTile(
                label: 'Conocimiento',
                value: '${controller.bundle.documents.length} archivos',
                accent: const Color(0xFF0F766E),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _WorkspaceMetricTile(
                label: 'Motor de IA',
                value: controller.bundle.openAi.isEnabled
                    ? controller.bundle.openAi.model
                    : 'Pausado',
                accent: const Color(0xFF9A3412),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _WorkspaceMetricTile extends StatelessWidget {
  const _WorkspaceMetricTile({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.26),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleLarge?.copyWith(
              color: accent,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
