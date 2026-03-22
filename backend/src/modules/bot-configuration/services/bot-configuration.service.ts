import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
import { ChannelsService } from '../../channels/channels.service';
import { CreatePromptTemplateDto } from '../dto/create-prompt-template.dto';
import { CreateToolDto } from '../dto/create-tool.dto';
import { UpdateEvolutionSettingsDto } from '../dto/update-evolution-settings.dto';
import { UpdateGeneralSettingsDto } from '../dto/update-general-settings.dto';
import { UpdateIntegrationsSettingsDto } from '../dto/update-integrations-settings.dto';
import { UpdateMemorySettingsDto } from '../dto/update-memory-settings.dto';
import { UpdateOpenAiSettingsDto } from '../dto/update-openai-settings.dto';
import { UpdateOrchestratorSettingsDto } from '../dto/update-orchestrator-settings.dto';
import { UpdatePromptTemplateDto } from '../dto/update-prompt-template.dto';
import { UpdateSecuritySettingsDto } from '../dto/update-security-settings.dto';
import { TestOpenAiConnectionDto } from '../dto/test-openai-connection.dto';
import { UpdateToolDto } from '../dto/update-tool.dto';
import { UpdateWhatsappSettingsDto } from '../dto/update-whatsapp-settings.dto';
import { BotConfigurationEntity } from '../entities/bot-configuration.entity';
import {
  BotConfigurationBundle,
  createDefaultBotConfiguration,
  EvolutionSettings,
  PromptTemplate,
  InternalToolSettings,
  normalizeBotConfiguration,
} from '../types/bot-configuration.types';

@Injectable()
export class BotConfigurationService implements OnModuleInit {
  private static constScope = 'default';
  private static readonly defaultOpenAiModel = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
  private readonly logger = new Logger(BotConfigurationService.name);
  private state!: BotConfigurationBundle;
  private snapshotId: string | null = null;

  constructor(
    private readonly fileStore: JsonFileStoreService,
    private readonly configService: ConfigService,
    @InjectRepository(BotConfigurationEntity)
    private readonly configurationRepository: Repository<BotConfigurationEntity>,
    private readonly channelsService: ChannelsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const fileSnapshot = normalizeBotConfiguration(await this.fileStore.readOrCreate(
      'bot-configuration.json',
      createDefaultBotConfiguration,
    ));

    const persistedSnapshot = await this.configurationRepository.findOne({
      where: { scope: BotConfigurationService.constScope },
    });

    if (persistedSnapshot) {
      this.snapshotId = persistedSnapshot.id;
      this.state = normalizeBotConfiguration(structuredClone(persistedSnapshot.payload));
      await this.fileStore.write('bot-configuration.json', this.state);
      return;
    }

    const createdSnapshot = await this.configurationRepository.save(
      this.configurationRepository.create({
        scope: BotConfigurationService.constScope,
        payload: fileSnapshot,
      }),
    );

    this.snapshotId = createdSnapshot.id;
    this.state = structuredClone(createdSnapshot.payload);
  }

  getConfiguration(): BotConfigurationBundle {
    return structuredClone(this.state);
  }

  getPromptById(promptId: string): PromptTemplate {
    const prompt = this.state.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    return structuredClone(prompt);
  }

  getActivePrompt(): PromptTemplate {
    return structuredClone(this.state.prompts[0]);
  }

  listPrompts(): PromptTemplate[] {
    return structuredClone(this.state.prompts);
  }

  listTools(): InternalToolSettings[] {
    return structuredClone(this.state.tools);
  }

  async updateGeneralSettings(
    payload: UpdateGeneralSettingsDto,
  ): Promise<BotConfigurationBundle['general']> {
    this.state.general = {
      ...this.state.general,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.general);
  }

  async updateEvolutionSettings(
    payload: UpdateEvolutionSettingsDto,
  ): Promise<BotConfigurationBundle['evolution']> {
    this.state.evolution = {
      ...this.state.evolution,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.evolution);
  }

  async getEvolutionConnection(companyId: string): Promise<{
    channelId: string | null;
    instanceName: string;
    connectionStatus: string;
    provisioningStatus: string;
    provisioningError: string | null;
    qrCode: unknown;
  }> {
    const evolution = this.state.evolution;
    if (!evolution.channelId) {
      return {
        channelId: null,
        instanceName: evolution.instanceName,
        connectionStatus: evolution.connectionStatus ?? 'disconnected',
        provisioningStatus: evolution.provisioningStatus ?? 'idle',
        provisioningError: evolution.provisioningError ?? null,
        qrCode: null,
      };
    }

    try {
      const channel = await this.channelsService.get(companyId, evolution.channelId);
      return this.captureEvolutionChannelState(companyId, channel.id, {
        fallbackInstanceName: channel.instanceName ?? evolution.instanceName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Canal no disponible.';
      await this.updateEvolutionRuntimeState({
        channelId: null,
        connectionStatus: 'disconnected',
        provisioningStatus: 'failed',
        provisioningError: message,
      });

      return {
        channelId: null,
        instanceName: evolution.instanceName,
        connectionStatus: 'disconnected',
        provisioningStatus: 'failed',
        provisioningError: message,
        qrCode: null,
      };
    }
  }

  async provisionEvolutionChannel(companyId: string): Promise<{
    channelId: string | null;
    instanceName: string;
    connectionStatus: string;
    provisioningStatus: string;
    provisioningError: string | null;
    qrCode: unknown;
  }> {
    const evolution = this.state.evolution;

    if (evolution.channelId) {
      try {
        await this.channelsService.get(companyId, evolution.channelId);
        return this.captureEvolutionChannelState(companyId, evolution.channelId, {
          fallbackInstanceName: evolution.instanceName,
        });
      } catch (_) {
        await this.updateEvolutionRuntimeState({ channelId: null });
      }
    }

    const createdChannel = await this.channelsService.create(companyId, {
      type: 'whatsapp',
      name: this.buildEvolutionChannelName(),
      config: {
        instanceName: evolution.instanceName,
        connectedNumber: evolution.connectedNumber,
        webhookSecret: evolution.webhookSecret,
      },
    });

    return this.captureEvolutionChannelState(companyId, createdChannel.id, {
      fallbackInstanceName: createdChannel.instanceName ?? evolution.instanceName,
    });
  }

  async updateOpenAiSettings(
    payload: UpdateOpenAiSettingsDto,
  ): Promise<BotConfigurationBundle['openai']> {
    this.state.openai = {
      ...this.state.openai,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.openai);
  }

  getResolvedOpenAiRuntimeSettings(overrides?: {
    apiKey?: string | null;
    model?: string | null;
  }): {
    apiKey: string;
    model: string;
    apiUrl: string;
    source: 'request_override' | 'configuration' | 'environment';
    runtimeEnabled: boolean;
  } {
    const overrideApiKey = overrides?.apiKey?.trim() || '';
    const configurationApiKey = this.state.openai.apiKey?.trim() || '';
    const environmentApiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim() || '';
    const source: 'request_override' | 'configuration' | 'environment' = overrideApiKey
      ? 'request_override'
      : configurationApiKey
        ? 'configuration'
        : 'environment';
    const apiKey = overrideApiKey || configurationApiKey || environmentApiKey;

    return {
      apiKey,
      model:
        overrides?.model?.trim() ||
        this.state.openai.model.trim() ||
        BotConfigurationService.defaultOpenAiModel,
      apiUrl:
        this.configService.get<string>('OPENAI_API_URL')?.trim() ||
        'https://api.openai.com/v1/chat/completions',
      source,
      runtimeEnabled: this.state.openai.isEnabled,
    };
  }

  async testOpenAiConnection(payload: TestOpenAiConnectionDto): Promise<{
    ok: true;
    provider: 'openai';
    model: string;
    source: 'request_override' | 'configuration' | 'environment';
    runtimeEnabled: boolean;
  }> {
    const runtime = this.getResolvedOpenAiRuntimeSettings({
      apiKey: payload.apiKey,
      model: payload.model,
    });

    if (!this.hasUsableOpenAiCredentials(runtime.apiKey)) {
      throw new BadRequestException(
        'La API key de OpenAI no es válida o está vacía. Debe comenzar con sk-.',
      );
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(runtime.apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtime.apiKey}`,
        },
        body: JSON.stringify({
          model: runtime.model,
          temperature: 0,
          max_completion_tokens: 5,
          messages: [
            {
              role: 'user',
              content: 'Reply only with OK.',
            },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await this.extractOpenAiError(response);
        throw new ServiceUnavailableException(
          `No se pudo validar la API key de OpenAI. ${detail}`,
        );
      }

      this.logger.log(
        `[OPENAI TEST] success model=${runtime.model} source=${runtime.source} runtimeEnabled=${runtime.runtimeEnabled}`,
      );

      return {
        ok: true,
        provider: 'openai',
        model: runtime.model,
        source: runtime.source,
        runtimeEnabled: runtime.runtimeEnabled,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        `No se pudo conectar con OpenAI para validar la API key. ${error instanceof Error ? error.message : 'Error desconocido.'}`,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async updateIntegrationsSettings(
    payload: UpdateIntegrationsSettingsDto,
  ): Promise<BotConfigurationBundle['integrations']> {
    this.state.integrations = {
      ...this.state.integrations,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.integrations);
  }

  private hasUsableOpenAiCredentials(apiKey: string): boolean {
    return Boolean(apiKey && !apiKey.includes('*') && apiKey.startsWith('sk-'));
  }

  private async extractOpenAiError(response: Response): Promise<string> {
    const text = (await response.text()).trim();
    if (!text) {
      return `OpenAI devolvió estado ${response.status}.`;
    }

    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string };
        message?: string;
      };
      const message = parsed.error?.message?.trim() || parsed.message?.trim();
      if (message) {
        return message;
      }
    } catch (_) {
      // Preserve raw text below.
    }

    return text.length > 280 ? `${text.slice(0, 277)}...` : text;
  }

  async updateWhatsappSettings(
    payload: UpdateWhatsappSettingsDto,
  ): Promise<BotConfigurationBundle['whatsapp']> {
    this.state.whatsapp = {
      ...this.state.whatsapp,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.whatsapp);
  }

  async updateMemorySettings(
    payload: UpdateMemorySettingsDto,
  ): Promise<BotConfigurationBundle['memory']> {
    this.state.memory = {
      ...this.state.memory,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.memory);
  }

  async updateOrchestratorSettings(
    payload: UpdateOrchestratorSettingsDto,
  ): Promise<BotConfigurationBundle['orchestrator']> {
    this.state.orchestrator = {
      ...this.state.orchestrator,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.orchestrator);
  }

  async updateSecuritySettings(
    payload: UpdateSecuritySettingsDto,
  ): Promise<BotConfigurationBundle['security']> {
    this.state.security = {
      ...this.state.security,
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.security);
  }

  async createPrompt(payload: CreatePromptTemplateDto): Promise<PromptTemplate> {
    const created: PromptTemplate = {
      id: randomUUID(),
      title: payload.title,
      description: payload.description,
      content: payload.content,
      updatedAt: new Date().toISOString(),
    };
    this.state.prompts.push(created);
    await this.persist();
    return structuredClone(created);
  }

  async updatePrompt(
    promptId: string,
    payload: UpdatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    const index = this.state.prompts.findIndex((item) => item.id === promptId);

    if (index === -1) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    this.state.prompts[index] = {
      ...this.state.prompts[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    await this.persist();
    return structuredClone(this.state.prompts[index]);
  }

  async deletePrompt(promptId: string): Promise<void> {
    const nextPrompts = this.state.prompts.filter((item) => item.id !== promptId);

    if (nextPrompts.length === this.state.prompts.length) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    this.state.prompts = nextPrompts;
    await this.persist();
  }

  async createTool(payload: CreateToolDto): Promise<InternalToolSettings> {
    const created: InternalToolSettings = {
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      category: payload.category,
      isEnabled: payload.isEnabled,
      intents: payload.intents,
      requiresConfirmation: payload.requiresConfirmation,
    };
    this.state.tools.push(created);
    await this.persist();
    return structuredClone(created);
  }

  async updateTool(
    toolId: string,
    payload: UpdateToolDto,
  ): Promise<InternalToolSettings> {
    const index = this.state.tools.findIndex((item) => item.id === toolId);

    if (index === -1) {
      throw new NotFoundException(`Tool ${toolId} was not found.`);
    }

    this.state.tools[index] = {
      ...this.state.tools[index],
      ...payload,
    };
    await this.persist();
    return structuredClone(this.state.tools[index]);
  }

  async deleteTool(toolId: string): Promise<void> {
    const nextTools = this.state.tools.filter((item) => item.id !== toolId);

    if (nextTools.length === this.state.tools.length) {
      throw new NotFoundException(`Tool ${toolId} was not found.`);
    }

    this.state.tools = nextTools;
    await this.persist();
  }

  private async persist(): Promise<void> {
    const snapshot = this.configurationRepository.create({
      id: this.snapshotId ?? undefined,
      scope: BotConfigurationService.constScope,
      payload: this.state,
    });

    const savedSnapshot = await this.configurationRepository.save(snapshot);
    this.snapshotId = savedSnapshot.id;
    await this.fileStore.write('bot-configuration.json', this.state);
  }

  private async captureEvolutionChannelState(
    companyId: string,
    channelId: string,
    options: { fallbackInstanceName: string },
  ): Promise<{
    channelId: string | null;
    instanceName: string;
    connectionStatus: string;
    provisioningStatus: string;
    provisioningError: string | null;
    qrCode: unknown;
  }> {
    let connectionStatus = this.state.evolution.connectionStatus ?? 'connecting';
    let provisioningStatus = 'ready';
    let provisioningError: string | null = null;
    let qrCode: unknown = null;
    let instanceName = options.fallbackInstanceName;

    try {
      const status = await this.channelsService.refreshConnectionStatus(companyId, channelId);
      connectionStatus = status.status;
    } catch (error) {
      connectionStatus = 'disconnected';
      provisioningStatus = 'failed';
      provisioningError = error instanceof Error ? error.message : 'No se pudo consultar el estado.';
    }

    try {
      const qr = await this.channelsService.getQrCode(companyId, channelId);
      qrCode = qr.payload;
      instanceName = qr.instanceName;
    } catch (_) {
      qrCode = null;
    }

    await this.updateEvolutionRuntimeState({
      channelId,
      instanceName,
      connectionStatus,
      provisioningStatus,
      provisioningError,
    });

    return {
      channelId,
      instanceName,
      connectionStatus,
      provisioningStatus,
      provisioningError,
      qrCode,
    };
  }

  private async updateEvolutionRuntimeState(
    payload: Partial<EvolutionSettings>,
  ): Promise<void> {
    this.state.evolution = {
      ...this.state.evolution,
      ...payload,
    };
    await this.persist();
  }

  private buildEvolutionChannelName(): string {
    const botName = this.state.general.botName.trim();
    return botName.length > 0
        ? `${botName} WhatsApp`
        : 'Canal WhatsApp principal';
  }
}