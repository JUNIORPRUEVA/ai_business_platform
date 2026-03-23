import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../domain/entities/bot_configuration_section.dart';
import '../controllers/bot_configuration_center_controller.dart';
import 'configuration_shell_widgets.dart';

const int _recommendedPromptMaxChars = 3000;

class GeneralSettingsSection extends StatelessWidget {
  const GeneralSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Configuración general',
          subtitle:
              'Controla la identidad pública y la postura del entorno del bot.',
          child: Column(
            children: [
              const _CompactInfoCard(
                icon: Icons.info_outline_rounded,
                title: 'Uso',
                message:
                    'El prompt principal se edita en la sección Prompts. Aquí configuras la identidad general del bot y, por separado, el motor de IA.',
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Nombre del bot',
                  controller: controller.generalBotNameController,
                ),
                LabeledDropdownField(
                  label: 'Idioma predeterminado',
                  value: controller.selectedLanguage,
                  items: controller.availableLanguages,
                  onChanged: controller.setLanguage,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Habilitar bot',
                  description:
                      'Permite que la capa de orquestación responda el tráfico en vivo.',
                  value: controller.bundle.general.isEnabled,
                  onChanged: controller.toggleGeneralEnabled,
                ),
                LabeledTextField(
                  label: 'Etiqueta de entorno',
                  controller: controller.generalEnvironmentController,
                ),
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.general),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.general,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class EvolutionApiSettingsSection extends StatelessWidget {
  const EvolutionApiSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Evolution API',
          subtitle:
              'Configura conectividad del canal, credenciales y confianza del webhook.',
          child: Column(
            children: [
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'URL base',
                  controller: controller.evolutionBaseUrlController,
                ),
                LabeledTextField(
                  label: 'Nombre de instancia',
                  controller: controller.evolutionInstanceController,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'API key',
                  controller: controller.evolutionApiKeyController,
                  obscureText: true,
                ),
                LabeledTextField(
                  label: 'Secreto del webhook',
                  controller: controller.evolutionWebhookSecretController,
                  obscureText: true,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Número conectado',
                  controller: controller.evolutionConnectedNumberController,
                ),
                SettingSwitchTile(
                  label: 'Habilitar Evolution API',
                  description:
                      'Permite que el bot use esta integración de canal en producción.',
                  value: controller.bundle.evolutionApi.isEnabled,
                  onChanged: controller.toggleEvolutionEnabled,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Estado de la instancia',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Canal: ${controller.bundle.evolutionApi.channelId ?? 'Sin canal enlazado'}',
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Conexión: ${controller.bundle.evolutionApi.connectionStatus}',
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Provisionamiento: ${controller.bundle.evolutionApi.provisioningStatus}',
                    ),
                    if (controller.evolutionQrImageBytes != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Escanea este codigo QR con WhatsApp',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 10),
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color:
                                  Theme.of(context).colorScheme.outlineVariant,
                            ),
                          ),
                          child: Image.memory(
                            controller.evolutionQrImageBytes!,
                            width: 220,
                            height: 220,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ],
                    if ((controller.evolutionPairingCode ?? '')
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Codigo de pareado',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                        child: SelectableText(
                          controller.evolutionPairingCode!,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    letterSpacing: 1.2,
                                  ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () {
                              Clipboard.setData(
                                ClipboardData(
                                  text: controller.evolutionPairingCode!,
                                ),
                              );
                              controller.dismissBanners();
                            },
                            icon: const Icon(Icons.copy_rounded),
                            label: const Text('Copiar codigo'),
                          ),
                        ],
                      ),
                    ],
                    if ((controller.bundle.evolutionApi.provisioningError ?? '')
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        controller.bundle.evolutionApi.provisioningError!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFFB42318),
                            ),
                      ),
                    ],
                    if ((controller.evolutionQrPayloadPreview ?? '')
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Respuesta tecnica de Evolution',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 8),
                      SelectableText(controller.evolutionQrPayloadPreview!),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 12,
                runSpacing: 12,
                children: [
                  OutlinedButton.icon(
                    onPressed: controller.isRefreshingEvolution
                        ? null
                        : controller.refreshEvolutionConnection,
                    icon: const Icon(Icons.sync_rounded),
                    label: Text(
                      controller.isRefreshingEvolution
                          ? 'Actualizando...'
                          : 'Actualizar estado',
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: controller.isProvisioningEvolution
                        ? null
                        : controller.provisionEvolutionInstance,
                    icon: const Icon(Icons.add_link_rounded),
                    label: Text(
                      controller.isProvisioningEvolution
                          ? 'Creando instancia...'
                          : 'Crear instancia',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () => controller
                      .saveSection(BotConfigurationSection.evolutionApi),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.evolutionApi,
                  onTestConnection: () => controller
                      .testConnection(BotConfigurationSection.evolutionApi),
                  isTesting: controller.isTesting,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class OpenAiSettingsSection extends StatelessWidget {
  const OpenAiSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Motor de IA',
          subtitle: 'Modelo, clave y prompt técnico de respaldo para el motor.',
          child: Column(
            children: [
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'API key',
                  controller: controller.openAiApiKeyController,
                  obscureText: true,
                  hintText: 'sk-...',
                ),
                LabeledDropdownField(
                  label: 'Modelo',
                  value: controller.selectedOpenAiModel,
                  items: controller.availableModels,
                  onChanged: controller.setOpenAiModel,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Creatividad',
                  controller: controller.openAiTemperatureController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                ),
                LabeledTextField(
                  label: 'Max. tokens',
                  controller: controller.openAiMaxTokensController,
                  keyboardType: TextInputType.number,
                  hintText: '1400',
                ),
              ),
              const SizedBox(height: 16),
              SettingSwitchTile(
                label: 'IA activa',
                description: 'Permite respuestas con OpenAI en produccion.',
                value: controller.bundle.openAi.isEnabled,
                onChanged: controller.toggleOpenAiEnabled,
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: const Color(0xFFFDBA74),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      color: Color(0xFF9A3412),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'El prompt principal se edita en la sección Prompts. Este bloque es solo un respaldo técnico para OpenAI y no reemplaza el prompt principal del bot.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF9A3412),
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              LabeledTextField(
                label: 'Respaldo técnico del sistema',
                controller: controller.openAiSystemPromptPreviewController,
                maxLines: 6,
                hintText:
                    'Solo úsalo como respaldo corto para el motor. El prompt principal se edita en Prompts.',
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.openAi),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.openAi,
                  onTestConnection: () =>
                      controller.testConnection(BotConfigurationSection.openAi),
                  isTesting: controller.isTesting,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class MemorySettingsSection extends StatelessWidget {
  const MemorySettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Configuración de memoria',
          subtitle:
              'Define qué capas de memoria están activas y dónde se persisten.',
          child: Column(
            children: [
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Memoria de corto plazo',
                  description:
                      'Mantén el contexto conversacional inmediato y los turnos recientes.',
                  value: controller.bundle.memory.enableShortTermMemory,
                  onChanged: (value) => controller.updateMemorySettings(
                      enableShortTermMemory: value),
                ),
                SettingSwitchTile(
                  label: 'Memoria de largo plazo',
                  description:
                      'Guarda conocimiento recurrente y hechos persistentes específicos del cliente.',
                  value: controller.bundle.memory.enableLongTermMemory,
                  onChanged: (value) => controller.updateMemorySettings(
                      enableLongTermMemory: value),
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Memoria operativa',
                  description:
                      'Retiene reglas de flujo, notas de seguridad e instrucciones de escalado.',
                  value: controller.bundle.memory.enableOperationalMemory,
                  onChanged: (value) => controller.updateMemorySettings(
                      enableOperationalMemory: value),
                ),
                SettingSwitchTile(
                  label: 'Resumen automático',
                  description:
                      'Comprime conversaciones largas en resúmenes empresariales duraderos.',
                  value: controller.bundle.memory.automaticSummarization,
                  onChanged: (value) => controller.updateMemorySettings(
                      automaticSummarization: value),
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Tamaño de ventana de mensajes recientes',
                  controller: controller.memoryWindowSizeController,
                  keyboardType: TextInputType.number,
                ),
                LabeledTextField(
                  label: 'TTL de la memoria',
                  controller: controller.memoryTtlController,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Usar Redis',
                  description:
                      'Usa Redis para recuperar rápidamente memoria de corta duración.',
                  value: controller.bundle.memory.useRedis,
                  onChanged: (value) =>
                      controller.updateMemorySettings(useRedis: value),
                ),
                SettingSwitchTile(
                  label: 'Usar PostgreSQL',
                  description:
                      'Persiste memoria duradera y registros de conocimiento listos para auditoría.',
                  value: controller.bundle.memory.usePostgreSql,
                  onChanged: (value) =>
                      controller.updateMemorySettings(usePostgreSql: value),
                ),
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.memory),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.memory,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class OrchestratorSettingsSection extends StatelessWidget {
  const OrchestratorSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Política del orquestador y cerebro',
          subtitle:
              'Ajusta cómo el bot razona, actúa y escala en flujos empresariales.',
          child: Column(
            children: [
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Modo automático',
                  description:
                      'Permite ejecución automática cuando el perfil de confianza es seguro.',
                  value: controller.bundle.orchestrator.automaticMode,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      automaticMode: value),
                ),
                SettingSwitchTile(
                  label: 'Modo asistido',
                  description:
                      'Permite sugerencias asistidas por operador y flujos de revisión controlados.',
                  value: controller.bundle.orchestrator.assistedMode,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      assistedMode: value),
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Detección de rol',
                  description:
                      'Identifica si quien habla es cliente, operador, gerente o sistema.',
                  value: controller.bundle.orchestrator.enableRoleDetection,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      enableRoleDetection: value),
                ),
                SettingSwitchTile(
                  label: 'Clasificación de intención',
                  description:
                      'Clasifica solicitudes entrantes antes del enrutamiento de prompt y herramientas.',
                  value:
                      controller.bundle.orchestrator.enableIntentClassification,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      enableIntentClassification: value),
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Ejecución de herramientas',
                  description:
                      'Permite que el orquestador llame herramientas internas cuando la política lo permita.',
                  value: controller.bundle.orchestrator.enableToolExecution,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      enableToolExecution: value),
                ),
                SettingSwitchTile(
                  label: 'Confirmación crítica',
                  description:
                      'Requiere confirmación explícita antes de ejecutar acciones riesgosas.',
                  value: controller.bundle.orchestrator
                      .requireConfirmationForCriticalActions,
                  onChanged: (value) => controller.updateOrchestratorSettings(
                      requireConfirmationForCriticalActions: value),
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                LabeledDropdownField(
                  label: 'Nivel de autonomía',
                  value: controller.selectedAutonomyLevel,
                  items: controller.availableAutonomyLevels,
                  onChanged: controller.setAutonomyLevel,
                ),
                LabeledDropdownField(
                  label: 'Estrategia de respaldo',
                  value: controller.selectedFallbackStrategy,
                  items: controller.availableFallbackStrategies,
                  onChanged: controller.setFallbackStrategy,
                ),
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () => controller
                      .saveSection(BotConfigurationSection.orchestrator),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.orchestrator,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PromptsSettingsSection extends StatelessWidget {
  const PromptsSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    final prompts = controller.bundle.prompts;
    final selectedPrompt = controller.selectedPrompt;
    final selectedPromptContent = selectedPrompt.content;
    final promptLength = selectedPromptContent.trim().length;
    final isPromptTooLong = promptLength > _recommendedPromptMaxChars;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isStacked = constraints.maxWidth < 1100;

        final promptList = _WorkspaceSurface(
          title: 'Prompts editables',
          subtitle: 'Selecciona y edita.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ListView.separated(
                  itemCount: prompts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final prompt = prompts[index];
                    final isSelected = index == controller.selectedPromptIndex;

                    return InkWell(
                      onTap: () => controller.selectPrompt(index),
                      borderRadius: BorderRadius.circular(14),
                      child: Ink(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFF1F5F9)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF94A3B8)
                                : Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    prompt.title,
                                    style:
                                        Theme.of(context).textTheme.titleMedium,
                                  ),
                                ),
                                _EditorStatusChip(
                                  label: index == 0 ? 'Principal' : 'Apoyo',
                                  backgroundColor: index == 0
                                      ? const Color(0xFFDCFCE7)
                                      : const Color(0xFFE2E8F0),
                                  foregroundColor: index == 0
                                      ? const Color(0xFF166534)
                                      : const Color(0xFF334155),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              prompt.description,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );

        final promptEditor = _WorkspaceSurface(
          title: selectedPrompt.title,
          subtitle: null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _EditorStatusChip(
                    label: controller.selectedPromptIndex == 0
                        ? 'Prompt principal'
                        : 'Prompt de apoyo',
                    backgroundColor: controller.selectedPromptIndex == 0
                        ? const Color(0xFFDCFCE7)
                        : const Color(0xFFE2E8F0),
                    foregroundColor: controller.selectedPromptIndex == 0
                        ? const Color(0xFF166534)
                        : const Color(0xFF334155),
                  ),
                  _EditorStatusChip(
                    label: '${selectedPromptContent.trim().length} caracteres',
                    backgroundColor: const Color(0xFFF8FAFC),
                    foregroundColor: const Color(0xFF475569),
                  ),
                  _EditorStatusChip(
                    label:
                        'Actualizado ${_formatTimestamp(selectedPrompt.updatedAt)}',
                    backgroundColor: const Color(0xFFF8FAFC),
                    foregroundColor: const Color(0xFF475569),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, editorConstraints) {
                    final canShowPreview = editorConstraints.maxHeight >= 260;
                    final showPreviewBelow =
                        canShowPreview && editorConstraints.maxWidth < 980;

                    final editorSurface = _InnerPanelSurface(
                      title: 'Contenido del prompt',
                      subtitle: null,
                      child: _PromptTextEditor(
                        promptId: selectedPrompt.id,
                        initialText: selectedPromptContent,
                        onChanged: controller.updatePromptContent,
                      ),
                    );

                    final previewSurface = _PromptPreviewWorkbench(
                      key: ValueKey<String>('preview-${selectedPrompt.id}'),
                      promptTitle: selectedPrompt.title,
                      promptText: selectedPromptContent,
                      isPrimaryPrompt: controller.selectedPromptIndex == 0,
                    );

                    if (!canShowPreview) {
                      return editorSurface;
                    }

                    if (showPreviewBelow) {
                      return Column(
                        children: [
                          Expanded(flex: 6, child: editorSurface),
                          const SizedBox(height: 16),
                          Expanded(flex: 4, child: previewSurface),
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Flexible(flex: 7, child: editorSurface),
                        const SizedBox(width: 16),
                        Flexible(flex: 5, child: previewSurface),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.prompts),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.prompts,
                ),
              ),
            ],
          ),
        );

        if (isStacked) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: 320, child: promptList),
              const SizedBox(height: 16),
              Expanded(child: promptEditor),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(flex: 3, child: promptList),
            const SizedBox(width: 16),
            Flexible(flex: 7, child: promptEditor),
          ],
        );
      },
    );
  }
}

class ToolsSettingsSection extends StatelessWidget {
  const ToolsSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Activación de herramientas internas',
          subtitle:
              'Habilita o deshabilita capacidades internas expuestas al orquestador.',
          child: Column(
            children: [
              ...controller.bundle.tools.map(
                (tool) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SettingSwitchTile(
                    label: '${tool.name} • ${tool.category}',
                    description: tool.description,
                    value: tool.isEnabled,
                    onChanged: (value) => controller.toggleTool(tool.id, value),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.tools),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.tools,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class DocumentsSettingsSection extends StatelessWidget {
  const DocumentsSettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    final selectedDocument = controller.selectedDocument;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isStacked = constraints.maxWidth < 1100;

        final knowledgeList = _WorkspaceSurface(
          title: 'Base de conocimiento',
          subtitle: 'Archivos disponibles.',
          trailing: OutlinedButton.icon(
            onPressed:
                controller.isUploadingDocument ? null : controller.addDocument,
            icon: const Icon(Icons.add_rounded),
            label: Text(
              controller.isUploadingDocument ? 'Cargando...' : 'Agregar',
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ListView.separated(
                  itemCount: controller.bundle.documents.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final document = controller.bundle.documents[index];
                    final isSelected =
                        index == controller.selectedDocumentIndex;

                    return InkWell(
                      onTap: () => controller.selectDocument(index),
                      borderRadius: BorderRadius.circular(14),
                      child: Ink(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFF1F5F9)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF94A3B8)
                                : Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              document.name,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${document.kind} • ${document.status} • ${document.sizeLabel}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              document.summary,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );

        final knowledgeEditor = _WorkspaceSurface(
          title: selectedDocument?.name ?? 'Sin documentos',
          subtitle: selectedDocument == null ? 'Sin archivos.' : null,
          child: selectedDocument == null
              ? Center(
                  child: Text(
                    'Agrega el primer archivo para empezar.',
                    style: Theme.of(context).textTheme.bodyLarge,
                    textAlign: TextAlign.center,
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _EditorStatusChip(
                          label: selectedDocument.kind,
                          backgroundColor: const Color(0xFFF8FAFC),
                          foregroundColor: const Color(0xFF334155),
                        ),
                        _EditorStatusChip(
                          label: selectedDocument.sizeLabel,
                          backgroundColor: const Color(0xFFF8FAFC),
                          foregroundColor: const Color(0xFF334155),
                        ),
                        _EditorStatusChip(
                          label: selectedDocument.isEnabled
                              ? 'Disponible para respuestas'
                              : 'Excluido de respuestas',
                          backgroundColor: selectedDocument.isEnabled
                              ? const Color(0xFFDCFCE7)
                              : const Color(0xFFFEE2E2),
                          foregroundColor: selectedDocument.isEnabled
                              ? const Color(0xFF166534)
                              : const Color(0xFF991B1B),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Activa o desactiva este material para el runtime y documenta aquí lo que el bot debe aprender de él.',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: const Color(0xFF64748B),
                                ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Switch(
                          value: selectedDocument.isEnabled,
                          onChanged: (value) => controller.toggleDocument(
                            selectedDocument.id,
                            value,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: _InnerPanelSurface(
                        title: 'Resumen operativo para el bot',
                        subtitle:
                            'Describe el contenido útil del archivo, restricciones, políticas y respuestas aprobadas.',
                        child: TextFormField(
                          key: ValueKey<String>(selectedDocument.id),
                          initialValue: selectedDocument.summary,
                          expands: true,
                          minLines: null,
                          maxLines: null,
                          onChanged: (value) =>
                              controller.updateDocumentSummary(
                            selectedDocument.id,
                            value,
                          ),
                          decoration: const InputDecoration(
                            hintText:
                                'Ejemplo: catálogo con productos, variantes, precios aprobados, restricciones de entrega y respuestas frecuentes.',
                            alignLabelWithHint: true,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton.icon(
                          onPressed: controller.isUploadingDocument
                              ? null
                              : () => controller.removeDocument(
                                    selectedDocument.id,
                                  ),
                          icon: const Icon(Icons.delete_outline_rounded),
                          label: const Text('Eliminar'),
                        ),
                        SectionActionBar(
                          onSave: () => controller
                              .saveSection(BotConfigurationSection.documents),
                          isSaving: controller.activeSaveSection ==
                              BotConfigurationSection.documents,
                        ),
                      ],
                    ),
                  ],
                ),
        );

        if (isStacked) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: 320, child: knowledgeList),
              const SizedBox(height: 16),
              Expanded(child: knowledgeEditor),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(flex: 3, child: knowledgeList),
            const SizedBox(width: 16),
            Flexible(flex: 7, child: knowledgeEditor),
          ],
        );
      },
    );
  }
}

class _EditorStatusChip extends StatelessWidget {
  const _EditorStatusChip({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: foregroundColor.withValues(alpha: 0.16),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _WorkspaceSurface extends StatelessWidget {
  const _WorkspaceSurface({
    required this.title,
    required this.child,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F0F172A),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleLarge),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF64748B),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                trailing!,
              ],
            ],
          ),
          const SizedBox(height: 16),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _InnerPanelSurface extends StatelessWidget {
  const _InnerPanelSurface({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF64748B),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _PromptTextEditor extends StatefulWidget {
  const _PromptTextEditor({
    required this.promptId,
    required this.initialText,
    required this.onChanged,
  });

  final String promptId;
  final String initialText;
  final ValueChanged<String> onChanged;

  @override
  State<_PromptTextEditor> createState() => _PromptTextEditorState();
}

class _PromptTextEditorState extends State<_PromptTextEditor> {
  late final TextEditingController _textController;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialText);
    _focusNode = FocusNode(debugLabel: 'prompt-editor-focus');
  }

  @override
  void didUpdateWidget(covariant _PromptTextEditor oldWidget) {
    super.didUpdateWidget(oldWidget);

    final promptChanged = oldWidget.promptId != widget.promptId;
    final externalTextChanged = oldWidget.initialText != widget.initialText;

    if ((promptChanged || externalTextChanged) &&
        _textController.text != widget.initialText) {
      _textController.value = TextEditingValue(
        text: widget.initialText,
        selection: TextSelection.collapsed(offset: widget.initialText.length),
      );
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textLength = _textController.text.trim().length;
    final isTooLong = textLength > _recommendedPromptMaxChars;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: TextField(
            key: ValueKey<String>('prompt-editor-${widget.promptId}'),
            controller: _textController,
            focusNode: _focusNode,
            keyboardType: TextInputType.multiline,
            textInputAction: TextInputAction.newline,
            textCapitalization: TextCapitalization.sentences,
            maxLength: _recommendedPromptMaxChars,
            maxLengthEnforcement: MaxLengthEnforcement.enforced,
            expands: true,
            minLines: null,
            maxLines: null,
            enableInteractiveSelection: true,
            autocorrect: true,
            onChanged: (value) {
              setState(() {});
              widget.onChanged(value);
            },
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  height: 1.45,
                ),
            decoration: InputDecoration(
              hintText:
                  'Escribe aquí el prompt principal. Ejemplo: Eres el asistente comercial oficial de la empresa. Responde con tono claro, breve y sin inventar precios ni stock.',
              alignLabelWithHint: true,
              counterText: '',
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.all(18),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.primary,
                  width: 1.6,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                isTooLong
                    ? 'El prompt ya alcanzó el máximo recomendado. Manténlo en 3000 caracteres o menos para evitar respuestas más lentas o instrucciones confusas.'
                    : 'Máximo recomendado: 3000 caracteres. Rango ideal: 1200 a 2500 para mantener claridad, velocidad y buen seguimiento de instrucciones.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isTooLong
                          ? const Color(0xFFB42318)
                          : const Color(0xFF64748B),
                      height: 1.35,
                    ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '$textLength/$_recommendedPromptMaxChars',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: isTooLong
                        ? const Color(0xFFB42318)
                        : const Color(0xFF475569),
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ],
    );
  }
}

class SecuritySettingsSection extends StatelessWidget {
  const SecuritySettingsSection({required this.controller, super.key});

  final BotConfigurationCenterController controller;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        ConfigurationShellCard(
          title: 'Controles de seguridad y webhooks',
          subtitle:
              'Protege secretos, verifica solicitudes entrantes y mantiene auditabilidad.',
          child: Column(
            children: [
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Token interno de API',
                  controller: controller.securityInternalApiTokenController,
                  obscureText: true,
                ),
                LabeledTextField(
                  label: 'Secreto de firma del webhook',
                  controller: controller.securityWebhookSigningSecretController,
                  obscureText: true,
                ),
              ),
              const SizedBox(height: 16),
              _twoColumn(
                context,
                SettingSwitchTile(
                  label: 'Cifrar secretos',
                  description:
                      'Almacena credenciales usando la política de almacenamiento seguro de secretos.',
                  value: controller.bundle.security.encryptSecrets,
                  onChanged: (value) =>
                      controller.updateSecuritySettings(encryptSecrets: value),
                ),
                SettingSwitchTile(
                  label: 'Registro de auditoría',
                  description:
                      'Registra cambios de configuración y acciones privilegiadas para revisión de cumplimiento.',
                  value: controller.bundle.security.auditLog,
                  onChanged: (value) =>
                      controller.updateSecuritySettings(auditLog: value),
                ),
              ),
              const SizedBox(height: 18),
              Align(
                alignment: Alignment.centerRight,
                child: SectionActionBar(
                  onSave: () =>
                      controller.saveSection(BotConfigurationSection.security),
                  isSaving: controller.activeSaveSection ==
                      BotConfigurationSection.security,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CompactInfoCard extends StatelessWidget {
  const _CompactInfoCard({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: theme.colorScheme.primary),
          const SizedBox(width: 12),
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
                const SizedBox(height: 4),
                Text(message, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PromptPreviewWorkbench extends StatefulWidget {
  const _PromptPreviewWorkbench({
    required this.promptTitle,
    required this.promptText,
    required this.isPrimaryPrompt,
    super.key,
  });

  final String promptTitle;
  final String promptText;
  final bool isPrimaryPrompt;

  @override
  State<_PromptPreviewWorkbench> createState() =>
      _PromptPreviewWorkbenchState();
}

class _PromptPreviewWorkbenchState extends State<_PromptPreviewWorkbench> {
  late final TextEditingController _testMessageController;

  @override
  void initState() {
    super.initState();
    _testMessageController = TextEditingController(
      text: 'Cliente: Hola, ¿tienen iPhone 15 en stock y cuál es el precio?',
    )..addListener(_handleDraftChanged);
  }

  @override
  void dispose() {
    _testMessageController
      ..removeListener(_handleDraftChanged)
      ..dispose();
    super.dispose();
  }

  void _handleDraftChanged() {
    if (!mounted) {
      return;
    }

    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final syntaxPreview = widget.promptText.trim().isEmpty
        ? 'Escribe un prompt para ver la vista previa estructurada.'
        : widget.promptText.trim();
    final simulatedReply = _buildSimulatedPromptReply(
      promptTitle: widget.promptTitle,
      promptText: widget.promptText,
      customerMessage: _testMessageController.text,
      isPrimaryPrompt: widget.isPrimaryPrompt,
    );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Vista previa y simulación',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: ListView(
              children: [
                _PreviewPanel(
                  title: 'Vista del prompt',
                  child: SelectableText(
                    syntaxPreview,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontFamily: 'Consolas',
                          height: 1.45,
                        ),
                  ),
                ),
                const SizedBox(height: 12),
                _PreviewPanel(
                  title: 'Simulación de respuesta',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: _testMessageController,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          hintText:
                              'Escribe un mensaje de prueba del cliente...',
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                        child: SelectableText(
                          simulatedReply,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(height: 1.45),
                        ),
                      ),
                    ],
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

class _PreviewPanel extends StatelessWidget {
  const _PreviewPanel({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compactHeader = constraints.maxHeight < 120;

        return Container(
          width: double.infinity,
          padding: EdgeInsets.all(compactHeader ? 10 : 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Theme.of(context).colorScheme.outlineVariant,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
              ),
              SizedBox(height: compactHeader ? 6 : 10),
              child,
            ],
          ),
        );
      },
    );
  }
}

String _buildSimulatedPromptReply({
  required String promptTitle,
  required String promptText,
  required String customerMessage,
  required bool isPrimaryPrompt,
}) {
  final normalizedPrompt = promptText.trim();
  final normalizedMessage = customerMessage.trim();

  if (normalizedPrompt.isEmpty) {
    return 'No hay contenido en este prompt todavía. Escribe el prompt para ver una simulación de comportamiento.';
  }

  if (normalizedMessage.isEmpty) {
    return 'Escribe un mensaje de prueba del cliente para generar una respuesta simulada.';
  }

  final lowerMessage = normalizedMessage.toLowerCase();
  final enforcesCatalogSafety = RegExp(
    'no invent|precio|stock|disponibilidad|catalog',
    caseSensitive: false,
  ).hasMatch(normalizedPrompt);
  final asksForAvailability = lowerMessage.contains('stock') ||
      lowerMessage.contains('disponib') ||
      lowerMessage.contains('tienen');
  final asksForPrice =
      lowerMessage.contains('precio') || lowerMessage.contains('cuesta');
  final asksForWarranty =
      lowerMessage.contains('garant') || lowerMessage.contains('devoluci');

  var probableReply =
      'Hola, puedo ayudarte con eso. Voy a revisar la información disponible antes de confirmar detalles.';

  if (asksForAvailability && asksForPrice) {
    probableReply = enforcesCatalogSafety
        ? 'Hola, puedo ayudarte con disponibilidad y precio. Primero reviso el catálogo y el stock confirmado para no inventar datos. Si me indicas la sucursal o variante exacta, te respondo con mayor precisión.'
        : 'Hola, puedo ayudarte con disponibilidad y precio. Si me dices la sucursal o variante exacta, te doy una respuesta más precisa.';
  } else if (asksForAvailability) {
    probableReply = enforcesCatalogSafety
        ? 'Hola, puedo revisar la disponibilidad, pero solo confirmaré stock cuando exista información validada en el sistema. Si me indicas sucursal o modelo exacto, continúo.'
        : 'Hola, puedo revisar la disponibilidad. Si me indicas el modelo exacto o la sucursal, continúo.';
  } else if (asksForPrice) {
    probableReply = enforcesCatalogSafety
        ? 'Hola, puedo ayudarte con el precio. Voy a usar solo precios aprobados en el catálogo para evitar información incorrecta.'
        : 'Hola, puedo ayudarte con el precio. Si me das el modelo exacto, te respondo mejor.';
  } else if (asksForWarranty) {
    probableReply =
        'Hola, puedo ayudarte con garantía y políticas. Voy a responder usando únicamente las condiciones aprobadas por la empresa.';
  }

  return 'Prompt activo: $promptTitle (${isPrimaryPrompt ? 'principal' : 'de apoyo'})\n'
      'Entrada de prueba: $normalizedMessage\n\n'
      'Lectura rápida de la intención del prompt:\n'
      '- Prompt cargado con ${normalizedPrompt.length} caracteres.\n'
      '- ${enforcesCatalogSafety ? 'Incluye reglas de seguridad para no inventar datos.' : 'No se detectan reglas explícitas de validación comercial en esta simulación.'}\n\n'
      'Respuesta simulada:\n'
      '$probableReply';
}

Widget _twoColumn(BuildContext context, Widget left, Widget right) {
  final isCompact = MediaQuery.of(context).size.width < 1200;
  if (isCompact) {
    return Column(
      children: [
        left,
        const SizedBox(height: 16),
        right,
      ],
    );
  }

  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(child: left),
      const SizedBox(width: 16),
      Expanded(child: right),
    ],
  );
}

String _formatTimestamp(DateTime value) {
  return '${value.day.toString().padLeft(2, '0')}/'
      '${value.month.toString().padLeft(2, '0')}/'
      '${value.year} '
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}
