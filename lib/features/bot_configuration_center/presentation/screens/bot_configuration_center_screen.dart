import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../domain/entities/bot_configuration_section.dart';
import '../controllers/bot_configuration_center_controller.dart';
import '../widgets/configuration_navigation_panel.dart';
import '../widgets/configuration_sections.dart';
import '../widgets/configuration_shell_widgets.dart';

class BotConfigurationCenterScreen extends StatefulWidget {
  const BotConfigurationCenterScreen({super.key, this.onBackToBotCenter});

  final VoidCallback? onBackToBotCenter;

  @override
  State<BotConfigurationCenterScreen> createState() =>
      _BotConfigurationCenterScreenState();
}

class _BotConfigurationCenterScreenState
    extends State<BotConfigurationCenterScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BotConfigurationCenterModule(
        embedded: false,
        onBackToBotCenter: widget.onBackToBotCenter,
      ),
    );
  }
}

class BotConfigurationCenterModule extends StatefulWidget {
  const BotConfigurationCenterModule({
    super.key,
    required this.embedded,
    this.onBackToBotCenter,
  });

  final bool embedded;
  final VoidCallback? onBackToBotCenter;

  @override
  State<BotConfigurationCenterModule> createState() =>
      _BotConfigurationCenterModuleState();
}

class _BotConfigurationCenterModuleState
    extends State<BotConfigurationCenterModule> {
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
        return BotConfigurationCenterContent(
          controller: _controller,
          onBackToBotCenter: widget.onBackToBotCenter,
          embedded: widget.embedded,
        );
      },
    );
  }
}

class BotConfigurationCenterContent extends StatelessWidget {
  const BotConfigurationCenterContent({
    super.key,
    required this.controller,
    this.onBackToBotCenter,
    this.embedded = false,
  });

  final BotConfigurationCenterController controller;
  final VoidCallback? onBackToBotCenter;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      decoration: embedded
          ? null
          : const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFF7FAFF), Color(0xFFF1F5FB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final contentPadding =
              embedded ? 0.0 : (constraints.maxWidth >= 1200 ? 24.0 : 16.0);
          final isDesktop = constraints.maxWidth >= 1320;
          final isMedium = constraints.maxWidth >= 980;

          return Padding(
            padding: EdgeInsets.all(contentPadding),
            child: Column(
              children: [
                _Header(
                  controller: controller,
                  onBackToBotCenter: onBackToBotCenter,
                ),
                const SizedBox(height: 18),
                if (controller.successMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: ConfigurationBanner(
                      message: controller.successMessage!,
                      isError: false,
                      onDismiss: controller.dismissBanners,
                    ),
                  ),
                if (controller.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: ConfigurationBanner(
                      message: controller.errorMessage!,
                      isError: true,
                      onDismiss: controller.dismissBanners,
                    ),
                  ),
                Expanded(
                  child: isDesktop
                      ? _DesktopLayout(controller: controller)
                      : isMedium
                          ? _MediumLayout(controller: controller)
                          : _CompactLayout(controller: controller),
                ),
              ],
            ),
          );
        },
      ),
    );

    if (embedded) {
      return content;
    }

    return SafeArea(child: content);
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.controller,
    this.onBackToBotCenter,
  });

  final BotConfigurationCenterController controller;
  final VoidCallback? onBackToBotCenter;

  @override
  Widget build(BuildContext context) {
    return ConfigurationShellCard(
      title: 'Centro de configuración del Bot FULLPOS',
      subtitle:
          'Panel de control empresarial para integraciones, prompts, memoria, política de inteligencia y operaciones seguras del runtime.',
      trailing: Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          OutlinedButton.icon(
            onPressed: () {
              if (onBackToBotCenter != null) {
                onBackToBotCenter!();
                return;
              }

              Navigator.maybeOf(context)?.maybePop();
            },
            icon: const Icon(Icons.arrow_back_rounded),
            label: const Text('Volver al Centro del Bot'),
          ),
        ],
      ),
      child: Wrap(
        spacing: 14,
        runSpacing: 14,
        children: [
          ConfigurationSummaryTile(
            label: 'Entorno',
            value: controller.bundle.general.environmentLabel,
            description:
                'Etiqueta de despliegue actual usada por el espacio administrativo.',
            accent: const Color(0xFF165DFF),
          ),
          ConfigurationSummaryTile(
            label: 'Motor de IA',
            value: controller.bundle.openAi.model,
            description:
                'Modelo principal y configuración operativa del motor de inteligencia.',
            accent: const Color(0xFF067647),
          ),
          ConfigurationSummaryTile(
            label: 'Herramientas',
            value:
                '${controller.bundle.tools.where((tool) => tool.isEnabled).length} herramientas activas',
            description:
                'Herramientas internas actualmente disponibles para la capa de orquestación.',
            accent: const Color(0xFFB54708),
          ),
        ],
      ),
    );
  }
}

class _DesktopLayout extends StatelessWidget {
  const _DesktopLayout({required this.controller});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 340,
          child: ConfigurationNavigationPanel(
            selectedSection: controller.selectedSection,
            onSelectSection: controller.selectSection,
          ),
        ),
        const SizedBox(width: 18),
        Expanded(child: _Workspace(controller: controller)),
      ],
    );
  }
}

class _MediumLayout extends StatelessWidget {
  const _MediumLayout({required this.controller});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 300,
          child: ConfigurationNavigationPanel(
            selectedSection: controller.selectedSection,
            onSelectSection: controller.selectSection,
          ),
        ),
        const SizedBox(width: 18),
        Expanded(child: _Workspace(controller: controller)),
      ],
    );
  }
}

class _CompactLayout extends StatelessWidget {
  const _CompactLayout({required this.controller});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final spacing = constraints.maxHeight < 720 ? 12.0 : 16.0;
        final sidebarHeight = math.max(360.0, constraints.maxHeight * 0.52);
        final workspaceHeight = math.max(680.0, constraints.maxHeight * 0.95);

        return ListView(
          children: [
            SizedBox(
              height: sidebarHeight,
              child: ConfigurationNavigationPanel(
                selectedSection: controller.selectedSection,
                onSelectSection: controller.selectSection,
              ),
            ),
            SizedBox(height: spacing),
            SizedBox(
                height: workspaceHeight,
                child: _Workspace(controller: controller)),
          ],
        );
      },
    );
  }
}

class _Workspace extends StatelessWidget {
  const _Workspace({required this.controller});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    final section = controller.selectedSection;

    switch (section) {
      case BotConfigurationSection.general:
        return GeneralSettingsSection(controller: controller);
      case BotConfigurationSection.evolutionApi:
        return EvolutionApiSettingsSection(controller: controller);
      case BotConfigurationSection.openAi:
        return OpenAiSettingsSection(controller: controller);
      case BotConfigurationSection.memory:
        return MemorySettingsSection(controller: controller);
      case BotConfigurationSection.orchestrator:
        return OrchestratorSettingsSection(controller: controller);
      case BotConfigurationSection.prompts:
        return PromptsSettingsSection(controller: controller);
      case BotConfigurationSection.tools:
        return ToolsSettingsSection(controller: controller);
      case BotConfigurationSection.documents:
        return DocumentsSettingsSection(controller: controller);
      case BotConfigurationSection.security:
        return SecuritySettingsSection(controller: controller);
    }
  }
}
