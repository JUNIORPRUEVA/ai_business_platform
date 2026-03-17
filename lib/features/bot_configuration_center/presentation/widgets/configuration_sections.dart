import 'package:flutter/material.dart';

import '../../domain/entities/bot_configuration_section.dart';
import '../controllers/bot_configuration_center_controller.dart';
import 'configuration_shell_widgets.dart';

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
                  label: 'Clave API',
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
                    if ((controller.evolutionQrPayloadPreview ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Respuesta QR / pairing',
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
          title: 'Runtime de OpenAI',
          subtitle:
              'Gestiona el acceso al modelo, el sesgo de seguridad y la política de generación.',
          child: Column(
            children: [
              _twoColumn(
                context,
                LabeledTextField(
                  label: 'Clave API',
                  controller: controller.openAiApiKeyController,
                  obscureText: true,
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
                  label: 'Temperatura',
                  controller: controller.openAiTemperatureController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                ),
                LabeledTextField(
                  label: 'Máximo de tokens',
                  controller: controller.openAiMaxTokensController,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(height: 16),
              SettingSwitchTile(
                label: 'Habilitar runtime de OpenAI',
                description:
                    'Permite que el bot empresarial enrute conversaciones a través de la capa LLM.',
                value: controller.bundle.openAi.isEnabled,
                onChanged: controller.toggleOpenAiEnabled,
              ),
              const SizedBox(height: 16),
              LabeledTextField(
                label: 'Vista previa del prompt del sistema',
                controller: controller.openAiSystemPromptPreviewController,
                maxLines: 5,
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

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 280,
          child: ConfigurationShellCard(
            title: 'Activos de prompts',
            subtitle:
                'Selecciona un paquete de prompts para inspeccionar o actualizar.',
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: prompts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final prompt = prompts[index];
                final isSelected = index == controller.selectedPromptIndex;

                return InkWell(
                  onTap: () => controller.selectPrompt(index),
                  borderRadius: BorderRadius.circular(18),
                  child: Ink(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFEEF4FF)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFFB2CCFF)
                            : Theme.of(context).colorScheme.outlineVariant,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(prompt.title,
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(
                          prompt.description,
                          maxLines: 2,
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
        ),
        const SizedBox(width: 18),
        Expanded(
          child: ConfigurationShellCard(
            title: controller.selectedPrompt.title,
            subtitle: controller.selectedPrompt.description,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                        color: Theme.of(context).colorScheme.outlineVariant),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.history_toggle_off_rounded),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Última actualización: ${_formatTimestamp(controller.selectedPrompt.updatedAt)}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: TextField(
                    key: ValueKey<String>(controller.selectedPrompt.id),
                    controller: controller.promptContentController,
                    onChanged: controller.updatePromptContent,
                    expands: true,
                    minLines: null,
                    maxLines: null,
                    decoration: const InputDecoration(
                      hintText: 'Contenido del prompt',
                      alignLabelWithHint: true,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
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
          ),
        ),
      ],
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

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 320,
          child: ConfigurationShellCard(
            title: 'Base documental',
            subtitle:
                'Activos indexados que alimentan el cerebro con conocimiento verificable.',
            trailing: OutlinedButton.icon(
              onPressed: controller.isUploadingDocument
                  ? null
                  : controller.addDocument,
              icon: const Icon(Icons.add_rounded),
              label: Text(
                controller.isUploadingDocument ? 'Cargando...' : 'Registrar',
              ),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: controller.bundle.documents.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final document = controller.bundle.documents[index];
                final isSelected = index == controller.selectedDocumentIndex;

                return InkWell(
                  onTap: () => controller.selectDocument(index),
                  borderRadius: BorderRadius.circular(18),
                  child: Ink(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFEEF4FF)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFFB2CCFF)
                            : Theme.of(context).colorScheme.outlineVariant,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(document.name,
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(
                          '${document.kind} • ${document.status} • ${document.sizeLabel}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          document.summary,
                          maxLines: 2,
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
        ),
        const SizedBox(width: 18),
        Expanded(
          child: ConfigurationShellCard(
            title: selectedDocument?.name ?? 'Sin documentos',
            subtitle: selectedDocument == null
                ? 'Aún no hay activos documentales registrados.'
                : 'Edita el resumen operativo que el cerebro usa en el contexto.',
            child: selectedDocument == null
                ? Center(
                    child: Text(
                      'Registra el primer documento empresarial para habilitar contexto documental.',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _twoColumn(
                        context,
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color:
                                  Theme.of(context).colorScheme.outlineVariant,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Tipo',
                                  style:
                                      Theme.of(context).textTheme.labelLarge),
                              const SizedBox(height: 8),
                              Text(selectedDocument.kind),
                            ],
                          ),
                        ),
                        SettingSwitchTile(
                          label: 'Documento activo',
                          description:
                              'Permite que este activo participe del contexto y recuperación del cerebro.',
                          value: selectedDocument.isEnabled,
                          onChanged: (value) => controller.toggleDocument(
                            selectedDocument.id,
                            value,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Resumen indexado',
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            key: ValueKey<String>(selectedDocument.id),
                            initialValue: selectedDocument.summary,
                            maxLines: 8,
                            onChanged: (value) =>
                                controller.updateDocumentSummary(
                                    selectedDocument.id, value),
                            decoration: const InputDecoration(
                              hintText:
                                  'Resume el conocimiento que debe usar el cerebro.',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Spacer(),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton.icon(
                            onPressed: controller.isUploadingDocument
                                ? null
                                : () => controller
                                    .removeDocument(selectedDocument.id),
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
          ),
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
