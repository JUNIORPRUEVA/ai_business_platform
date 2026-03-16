import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
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
import {
  BotConfigurationBundle,
  createDefaultBotConfiguration,
  PromptTemplate,
  InternalToolSettings,
} from '../types/bot-configuration.types';

@Injectable()
export class BotConfigurationService implements OnModuleInit {
  private state!: BotConfigurationBundle;

  constructor(private readonly fileStore: JsonFileStoreService) {}

  async onModuleInit(): Promise<void> {
    this.state = await this.fileStore.readOrCreate(
      'bot-configuration.json',
      createDefaultBotConfiguration,
    );
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
    await this.fileStore.write('bot-configuration.json', this.state);
  }
}