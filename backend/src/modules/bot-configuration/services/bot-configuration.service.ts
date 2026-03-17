import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
import { ChannelsService } from '../../channels/channels.service';
import { CreatePromptTemplateDto } from '../dto/create-prompt-template.dto';
import { CreateToolDto } from '../dto/create-tool.dto';
import { UpdateEvolutionSettingsDto } from '../dto/update-evolution-settings.dto';
import { UpdateGeneralSettingsDto } from '../dto/update-general-settings.dto';
import { UpdateMemorySettingsDto } from '../dto/update-memory-settings.dto';
import { UpdateOpenAiSettingsDto } from '../dto/update-openai-settings.dto';
import { UpdateOrchestratorSettingsDto } from '../dto/update-orchestrator-settings.dto';
import { UpdatePromptTemplateDto } from '../dto/update-prompt-template.dto';
import { UpdateSecuritySettingsDto } from '../dto/update-security-settings.dto';
import { UpdateToolDto } from '../dto/update-tool.dto';
import { BotConfigurationEntity } from '../entities/bot-configuration.entity';
import {
  BotConfigurationBundle,
  createDefaultBotConfiguration,
  EvolutionSettings,
  PromptTemplate,
  InternalToolSettings,
} from '../types/bot-configuration.types';

@Injectable()
export class BotConfigurationService implements OnModuleInit {
  private static constScope = 'default';
  private state!: BotConfigurationBundle;
  private snapshotId: string | null = null;

  constructor(
    private readonly fileStore: JsonFileStoreService,
    @InjectRepository(BotConfigurationEntity)
    private readonly configurationRepository: Repository<BotConfigurationEntity>,
    private readonly channelsService: ChannelsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const fileSnapshot = await this.fileStore.readOrCreate(
      'bot-configuration.json',
      createDefaultBotConfiguration,
    );

    const persistedSnapshot = await this.configurationRepository.findOne({
      where: { scope: BotConfigurationService.constScope },
    });

    if (persistedSnapshot) {
      this.snapshotId = persistedSnapshot.id;
      this.state = structuredClone(persistedSnapshot.payload);
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