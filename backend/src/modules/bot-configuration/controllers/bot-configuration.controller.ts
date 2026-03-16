import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

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
import { BotConfigurationService } from '../services/bot-configuration.service';
import { BotConfigurationBundle, PromptTemplate, InternalToolSettings } from '../types/bot-configuration.types';

@Controller('bot-configuration')
export class BotConfigurationController {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
  ) {}

  @Get()
  getConfiguration(): BotConfigurationBundle {
    return this.botConfigurationService.getConfiguration();
  }

  @Put('general')
  updateGeneral(@Body() payload: UpdateGeneralSettingsDto) {
    return this.botConfigurationService.updateGeneralSettings(payload);
  }

  @Put('evolution')
  updateEvolution(@Body() payload: UpdateEvolutionSettingsDto) {
    return this.botConfigurationService.updateEvolutionSettings(payload);
  }

  @Put('openai')
  updateOpenAi(@Body() payload: UpdateOpenAiSettingsDto) {
    return this.botConfigurationService.updateOpenAiSettings(payload);
  }

  @Put('memory')
  updateMemory(@Body() payload: UpdateMemorySettingsDto) {
    return this.botConfigurationService.updateMemorySettings(payload);
  }

  @Put('orchestrator')
  updateOrchestrator(@Body() payload: UpdateOrchestratorSettingsDto) {
    return this.botConfigurationService.updateOrchestratorSettings(payload);
  }

  @Put('security')
  updateSecurity(@Body() payload: UpdateSecuritySettingsDto) {
    return this.botConfigurationService.updateSecuritySettings(payload);
  }

  @Get('prompts')
  listPrompts(): PromptTemplate[] {
    return this.botConfigurationService.listPrompts();
  }

  @Post('prompts')
  createPrompt(@Body() payload: CreatePromptTemplateDto) {
    return this.botConfigurationService.createPrompt(payload);
  }

  @Put('prompts/:id')
  updatePrompt(
    @Param('id') promptId: string,
    @Body() payload: UpdatePromptTemplateDto,
  ) {
    return this.botConfigurationService.updatePrompt(promptId, payload);
  }

  @Delete('prompts/:id')
  deletePrompt(@Param('id') promptId: string) {
    return this.botConfigurationService.deletePrompt(promptId);
  }

  @Get('tools')
  listTools(): InternalToolSettings[] {
    return this.botConfigurationService.listTools();
  }

  @Post('tools')
  createTool(@Body() payload: CreateToolDto) {
    return this.botConfigurationService.createTool(payload);
  }

  @Put('tools/:id')
  updateTool(@Param('id') toolId: string, @Body() payload: UpdateToolDto) {
    return this.botConfigurationService.updateTool(toolId, payload);
  }

  @Delete('tools/:id')
  deleteTool(@Param('id') toolId: string) {
    return this.botConfigurationService.deleteTool(toolId);
  }
}