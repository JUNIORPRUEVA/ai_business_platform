import 'package:flutter/material.dart';

import '../../../../features/bot_configuration_center/presentation/controllers/bot_configuration_center_controller.dart';
import '../../../../features/bot_configuration_center/presentation/widgets/configuration_sections.dart';
import '../../../../features/bot_configuration_center/presentation/widgets/configuration_shell_widgets.dart';
import '../../../shared/presentation/widgets/module_header.dart';

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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ModuleHeader(
                title: 'Prompts y conocimiento',
                subtitle:
                    'Esta vista ya está conectada al backend real. Lo que guardes aquí se persiste y alimenta el runtime del bot.',
              ),
              const SizedBox(height: 14),
              const _RuntimeSourceCard(),
              const SizedBox(height: 14),
              if (_controller.successMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ConfigurationBanner(
                    message: _controller.successMessage!,
                    isError: false,
                    onDismiss: _controller.dismissBanners,
                  ),
                ),
              if (_controller.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ConfigurationBanner(
                    message: _controller.errorMessage!,
                    isError: true,
                    onDismiss: _controller.dismissBanners,
                  ),
                ),
              const Align(
                alignment: Alignment.centerLeft,
                child: TabBar(
                  isScrollable: true,
                  dividerColor: Colors.transparent,
                  tabAlignment: TabAlignment.start,
                  tabs: [
                    Tab(text: 'Editor de prompts'),
                    Tab(text: 'Base de conocimiento'),
                    Tab(text: 'Runtime IA'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
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
          ),
        );
      },
    );
  }
}

class _RuntimeSourceCard extends StatelessWidget {
  const _RuntimeSourceCard();

  @override
  Widget build(BuildContext context) {
    return const ConfigurationShellCard(
      title: 'Fuente real del bot',
      subtitle:
          'La prioridad actual del runtime ya está alineada con lo que configuras aquí.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SourceBullet(
            title: '1. Editor de prompts',
            description:
                'El primer prompt configurado es la instrucción principal que usa el bot al responder.',
          ),
          SizedBox(height: 10),
          _SourceBullet(
            title: '2. Base de conocimiento',
            description:
                'Los documentos activos agregan contexto documental y resúmenes al cerebro del bot.',
          ),
          SizedBox(height: 10),
          _SourceBullet(
            title: '3. Runtime IA',
            description:
                'La vista previa del prompt del sistema queda como respaldo si no existe un prompt principal configurado.',
          ),
        ],
      ),
    );
  }
}

class _SourceBullet extends StatelessWidget {
  const _SourceBullet({
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 10,
          height: 10,
          margin: const EdgeInsets.only(top: 5),
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
