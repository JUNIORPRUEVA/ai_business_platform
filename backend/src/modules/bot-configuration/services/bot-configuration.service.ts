import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
import { ChannelsService } from '../../channels/channels.service';
import { CreatePromptTemplateDto } from '../dto/create-prompt-template.dto';
import { CreateToolDto } from '../dto/create-tool.dto';
import { TestOpenAiConnectionDto } from '../dto/test-openai-connection.dto';
import { UpdateEvolutionSettingsDto } from '../dto/update-evolution-settings.dto';
import { UpdateGeneralSettingsDto } from '../dto/update-general-settings.dto';
import { UpdateIntegrationsSettingsDto } from '../dto/update-integrations-settings.dto';
import { UpdateMemorySettingsDto } from '../dto/update-memory-settings.dto';
import { UpdateOpenAiSettingsDto } from '../dto/update-openai-settings.dto';
import { UpdateOrchestratorSettingsDto } from '../dto/update-orchestrator-settings.dto';
import { UpdatePromptTemplateDto } from '../dto/update-prompt-template.dto';
import { UpdateSecuritySettingsDto } from '../dto/update-security-settings.dto';
import { UpdateToolDto } from '../dto/update-tool.dto';
import { UpdateWhatsappSettingsDto } from '../dto/update-whatsapp-settings.dto';
import { BotConfigurationEntity } from '../entities/bot-configuration.entity';
import {
  BotConfigurationBundle,
  createDefaultBotConfiguration,
  EvolutionSettings,
  InternalToolSettings,
  normalizeBotConfiguration,
  PromptTemplate,
} from '../types/bot-configuration.types';

@Injectable()
export class BotConfigurationService implements OnModuleInit {
  private static readonly constScope = 'default';
  private static readonly defaultOpenAiModel =
    process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

  private readonly logger = new Logger(BotConfigurationService.name);
  private readonly stateByCompany = new Map<string, BotConfigurationBundle>();
  private readonly snapshotIdByCompany = new Map<string, string>();
  private defaultState!: BotConfigurationBundle;
  private defaultSnapshotId: string | null = null;

  constructor(
    private readonly fileStore: JsonFileStoreService,
    private readonly configService: ConfigService,
    @InjectRepository(BotConfigurationEntity)
    private readonly configurationRepository: Repository<BotConfigurationEntity>,
    private readonly channelsService: ChannelsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const fileSnapshot = normalizeBotConfiguration(
      await this.fileStore.readOrCreate(
        'bot-configuration.json',
        createDefaultBotConfiguration,
      ),
    );

    const persistedSnapshot = await this.configurationRepository.findOne({
      where: {
        scope: BotConfigurationService.constScope,
        companyId: IsNull(),
      },
    });

    if (persistedSnapshot) {
      this.defaultSnapshotId = persistedSnapshot.id;
      this.defaultState = normalizeBotConfiguration(
        structuredClone(persistedSnapshot.payload),
      );
      await this.fileStore.write('bot-configuration.json', this.defaultState);
      return;
    }

    const createdSnapshot = await this.configurationRepository.save(
      this.configurationRepository.create({
        companyId: null,
        scope: BotConfigurationService.constScope,
        payload: fileSnapshot,
      }),
    );

    this.defaultSnapshotId = createdSnapshot.id;
    this.defaultState = structuredClone(createdSnapshot.payload);
  }

  async getConfiguration(companyId: string): Promise<BotConfigurationBundle> {
    const state = await this.ensureCompanyState(companyId);
    return structuredClone(state);
  }

  getDefaultConfiguration(): BotConfigurationBundle {
    return structuredClone(this.defaultState);
  }

  async getPromptById(companyId: string, promptId: string): Promise<PromptTemplate> {
    const state = await this.ensureCompanyState(companyId);
    const prompt = state.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    return structuredClone(prompt);
  }

  async getActivePrompt(companyId: string): Promise<PromptTemplate> {
    const state = await this.ensureCompanyState(companyId);
    return structuredClone(state.prompts[0]);
  }

  async listPrompts(companyId: string): Promise<PromptTemplate[]> {
    const state = await this.ensureCompanyState(companyId);
    return structuredClone(state.prompts);
  }

  async listTools(companyId: string): Promise<InternalToolSettings[]> {
    const state = await this.ensureCompanyState(companyId);
    return structuredClone(state.tools);
  }

  async updateGeneralSettings(
    companyId: string,
    payload: UpdateGeneralSettingsDto,
  ): Promise<BotConfigurationBundle['general']> {
    const state = await this.ensureCompanyState(companyId);
    state.general = {
      ...state.general,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.general);
  }

  async updateEvolutionSettings(
    companyId: string,
    payload: UpdateEvolutionSettingsDto,
  ): Promise<BotConfigurationBundle['evolution']> {
    const state = await this.ensureCompanyState(companyId);
    state.evolution = {
      ...state.evolution,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.evolution);
  }

  async getEvolutionConnection(companyId: string): Promise<{
    channelId: string | null;
    instanceName: string;
    connectionStatus: string;
    provisioningStatus: string;
    provisioningError: string | null;
    qrCode: unknown;
  }> {
    const state = await this.ensureCompanyState(companyId);
    const evolution = state.evolution;
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
      const message =
        error instanceof Error ? error.message : 'Canal no disponible.';
      await this.updateEvolutionRuntimeState(companyId, {
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
    const state = await this.ensureCompanyState(companyId);
    const evolution = state.evolution;

    if (evolution.channelId) {
      try {
        await this.channelsService.get(companyId, evolution.channelId);
        return this.captureEvolutionChannelState(companyId, evolution.channelId, {
          fallbackInstanceName: evolution.instanceName,
        });
      } catch (_) {
        await this.updateEvolutionRuntimeState(companyId, { channelId: null });
      }
    }

    const createdChannel = await this.channelsService.create(companyId, {
      type: 'whatsapp',
      name: this.buildEvolutionChannelName(state),
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
    companyId: string,
    payload: UpdateOpenAiSettingsDto,
  ): Promise<BotConfigurationBundle['openai']> {
    const state = await this.ensureCompanyState(companyId);
    state.openai = {
      ...state.openai,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.openai);
  }

  async getResolvedOpenAiRuntimeSettings(
    companyId?: string | null,
    overrides?: {
      apiKey?: string | null;
      model?: string | null;
    },
  ): Promise<{
    apiKey: string;
    model: string;
    apiUrl: string;
    source: 'request_override' | 'configuration' | 'environment';
    runtimeEnabled: boolean;
  }> {
    const configuration = companyId
      ? await this.ensureCompanyState(companyId)
      : this.defaultState;
    const overrideApiKey = overrides?.apiKey?.trim() || '';
    const configurationApiKey = configuration.openai.apiKey?.trim() || '';
    const environmentApiKey =
      this.configService.get<string>('OPENAI_API_KEY')?.trim() || '';
    const source: 'request_override' | 'configuration' | 'environment' =
      overrideApiKey
        ? 'request_override'
        : configurationApiKey
          ? 'configuration'
          : 'environment';
    const apiKey = overrideApiKey || configurationApiKey || environmentApiKey;

    return {
      apiKey,
      model:
        overrides?.model?.trim() ||
        configuration.openai.model.trim() ||
        BotConfigurationService.defaultOpenAiModel,
      apiUrl:
        this.configService.get<string>('OPENAI_API_URL')?.trim() ||
        'https://api.openai.com/v1/chat/completions',
      source,
      runtimeEnabled: configuration.openai.isEnabled,
    };
  }

  async testOpenAiConnection(
    companyId: string,
    payload: TestOpenAiConnectionDto,
  ): Promise<{
    ok: true;
    provider: 'openai';
    model: string;
    source: 'request_override' | 'configuration' | 'environment';
    runtimeEnabled: boolean;
  }> {
    const runtime = await this.getResolvedOpenAiRuntimeSettings(companyId, {
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
        `[OPENAI TEST] success model=${runtime.model} source=${runtime.source} runtimeEnabled=${runtime.runtimeEnabled} companyId=${companyId}`,
      );

      return {
        ok: true,
        provider: 'openai',
        model: runtime.model,
        source: runtime.source,
        runtimeEnabled: runtime.runtimeEnabled,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        `No se pudo conectar con OpenAI para validar la API key. ${
          error instanceof Error ? error.message : 'Error desconocido.'
        }`,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async updateIntegrationsSettings(
    companyId: string,
    payload: UpdateIntegrationsSettingsDto,
  ): Promise<BotConfigurationBundle['integrations']> {
    const state = await this.ensureCompanyState(companyId);
    state.integrations = {
      ...state.integrations,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.integrations);
  }

  async updateWhatsappSettings(
    companyId: string,
    payload: UpdateWhatsappSettingsDto,
  ): Promise<BotConfigurationBundle['whatsapp']> {
    const state = await this.ensureCompanyState(companyId);
    state.whatsapp = {
      ...state.whatsapp,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.whatsapp);
  }

  async updateMemorySettings(
    companyId: string,
    payload: UpdateMemorySettingsDto,
  ): Promise<BotConfigurationBundle['memory']> {
    const state = await this.ensureCompanyState(companyId);
    state.memory = {
      ...state.memory,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.memory);
  }

  async updateOrchestratorSettings(
    companyId: string,
    payload: UpdateOrchestratorSettingsDto,
  ): Promise<BotConfigurationBundle['orchestrator']> {
    const state = await this.ensureCompanyState(companyId);
    state.orchestrator = {
      ...state.orchestrator,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.orchestrator);
  }

  async updateSecuritySettings(
    companyId: string,
    payload: UpdateSecuritySettingsDto,
  ): Promise<BotConfigurationBundle['security']> {
    const state = await this.ensureCompanyState(companyId);
    state.security = {
      ...state.security,
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.security);
  }

  async createPrompt(
    companyId: string,
    payload: CreatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    const state = await this.ensureCompanyState(companyId);
    const created: PromptTemplate = {
      id: randomUUID(),
      title: payload.title,
      description: payload.description,
      content: payload.content,
      updatedAt: new Date().toISOString(),
    };
    state.prompts.push(created);
    await this.persist(companyId, state);
    return structuredClone(created);
  }

  async updatePrompt(
    companyId: string,
    promptId: string,
    payload: UpdatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    const state = await this.ensureCompanyState(companyId);
    const index = state.prompts.findIndex((item) => item.id === promptId);

    if (index === -1) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    state.prompts[index] = {
      ...state.prompts[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    await this.persist(companyId, state);
    return structuredClone(state.prompts[index]);
  }

  async deletePrompt(companyId: string, promptId: string): Promise<void> {
    const state = await this.ensureCompanyState(companyId);
    const nextPrompts = state.prompts.filter((item) => item.id !== promptId);

    if (nextPrompts.length === state.prompts.length) {
      throw new NotFoundException(`Prompt ${promptId} was not found.`);
    }

    state.prompts = nextPrompts;
    await this.persist(companyId, state);
  }

  async createTool(
    companyId: string,
    payload: CreateToolDto,
  ): Promise<InternalToolSettings> {
    const state = await this.ensureCompanyState(companyId);
    const created: InternalToolSettings = {
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      category: payload.category,
      isEnabled: payload.isEnabled,
      intents: payload.intents,
      requiresConfirmation: payload.requiresConfirmation,
    };
    state.tools.push(created);
    await this.persist(companyId, state);
    return structuredClone(created);
  }

  async updateTool(
    companyId: string,
    toolId: string,
    payload: UpdateToolDto,
  ): Promise<InternalToolSettings> {
    const state = await this.ensureCompanyState(companyId);
    const index = state.tools.findIndex((item) => item.id === toolId);

    if (index === -1) {
      throw new NotFoundException(`Tool ${toolId} was not found.`);
    }

    state.tools[index] = {
      ...state.tools[index],
      ...payload,
    };
    await this.persist(companyId, state);
    return structuredClone(state.tools[index]);
  }

  async deleteTool(companyId: string, toolId: string): Promise<void> {
    const state = await this.ensureCompanyState(companyId);
    const nextTools = state.tools.filter((item) => item.id !== toolId);

    if (nextTools.length === state.tools.length) {
      throw new NotFoundException(`Tool ${toolId} was not found.`);
    }

    state.tools = nextTools;
    await this.persist(companyId, state);
  }

  private async ensureCompanyState(companyId: string): Promise<BotConfigurationBundle> {
    const cached = this.stateByCompany.get(companyId);
    if (cached) {
      return cached;
    }

    const snapshot = await this.configurationRepository.findOne({
      where: {
        companyId,
        scope: BotConfigurationService.constScope,
      },
    });

    if (snapshot) {
      const state = normalizeBotConfiguration(structuredClone(snapshot.payload));
      this.snapshotIdByCompany.set(companyId, snapshot.id);
      this.stateByCompany.set(companyId, state);
      await this.fileStore.write(this.buildCompanyStoragePath(companyId), state);
      return state;
    }

    const initialState = normalizeBotConfiguration(
      structuredClone(this.defaultState),
    );
    const createdSnapshot = await this.configurationRepository.save(
      this.configurationRepository.create({
        companyId,
        scope: BotConfigurationService.constScope,
        payload: initialState,
      }),
    );

    this.snapshotIdByCompany.set(companyId, createdSnapshot.id);
    this.stateByCompany.set(companyId, initialState);
    await this.fileStore.write(this.buildCompanyStoragePath(companyId), initialState);
    return initialState;
  }

  private async persist(
    companyId: string,
    state: BotConfigurationBundle,
  ): Promise<void> {
    const snapshot = this.configurationRepository.create({
      id: this.snapshotIdByCompany.get(companyId) ?? undefined,
      companyId,
      scope: BotConfigurationService.constScope,
      payload: state,
    });

    const savedSnapshot = await this.configurationRepository.save(snapshot);
    this.snapshotIdByCompany.set(companyId, savedSnapshot.id);
    this.stateByCompany.set(companyId, state);
    await this.fileStore.write(this.buildCompanyStoragePath(companyId), state);
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
    const state = await this.ensureCompanyState(companyId);
    let connectionStatus = state.evolution.connectionStatus ?? 'connecting';
    let provisioningStatus = 'ready';
    let provisioningError: string | null = null;
    let qrCode: unknown = null;
    let instanceName = options.fallbackInstanceName;

    try {
      const status = await this.channelsService.refreshConnectionStatus(
        companyId,
        channelId,
      );
      connectionStatus = status.status;
    } catch (error) {
      connectionStatus = 'disconnected';
      provisioningStatus = 'failed';
      provisioningError =
        error instanceof Error
          ? error.message
          : 'No se pudo consultar el estado.';
    }

    try {
      const qr = await this.channelsService.getQrCode(companyId, channelId);
      qrCode = qr.payload;
      instanceName = qr.instanceName;
    } catch (_) {
      qrCode = null;
    }

    await this.updateEvolutionRuntimeState(companyId, {
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
    companyId: string,
    payload: Partial<EvolutionSettings>,
  ): Promise<void> {
    const state = await this.ensureCompanyState(companyId);
    state.evolution = {
      ...state.evolution,
      ...payload,
    };
    await this.persist(companyId, state);
  }

  private buildEvolutionChannelName(state: BotConfigurationBundle): string {
    const botName = state.general.botName.trim();
    return botName.length > 0
      ? `${botName} WhatsApp`
      : 'Canal WhatsApp principal';
  }

  private buildCompanyStoragePath(companyId: string): string {
    return `bot-configurations/${companyId}.json`;
  }
}
