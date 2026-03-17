import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { AuthUser } from '../../../common/auth/auth.types';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenseGuard } from '../../billing/license.guard';
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

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('bot-configuration')
export class BotConfigurationController {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
  ) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  getConfiguration(): BotConfigurationBundle {
    return this.botConfigurationService.getConfiguration();
  }

  @Roles('admin', 'operator')
  @Put('general')
  updateGeneral(@Body() payload: UpdateGeneralSettingsDto) {
    return this.botConfigurationService.updateGeneralSettings(payload);
  }

  @Roles('admin', 'operator')
  @Put('evolution')
  updateEvolution(@Body() payload: UpdateEvolutionSettingsDto) {
    return this.botConfigurationService.updateEvolutionSettings(payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('evolution/connection')
  getEvolutionConnection(@CurrentUser() user: AuthUser) {
    return this.botConfigurationService.getEvolutionConnection(user.companyId);
  }

  @Roles('admin', 'operator')
  @Post('evolution/provision')
  provisionEvolution(@CurrentUser() user: AuthUser) {
    return this.botConfigurationService.provisionEvolutionChannel(user.companyId);
  }

  @Roles('admin', 'operator')
  @Put('openai')
  updateOpenAi(@Body() payload: UpdateOpenAiSettingsDto) {
    return this.botConfigurationService.updateOpenAiSettings(payload);
  }

  @Roles('admin', 'operator')
  @Put('memory')
  updateMemory(@Body() payload: UpdateMemorySettingsDto) {
    return this.botConfigurationService.updateMemorySettings(payload);
  }

  @Roles('admin', 'operator')
  @Put('orchestrator')
  updateOrchestrator(@Body() payload: UpdateOrchestratorSettingsDto) {
    return this.botConfigurationService.updateOrchestratorSettings(payload);
  }

  @Roles('admin', 'operator')
  @Put('security')
  updateSecurity(@Body() payload: UpdateSecuritySettingsDto) {
    return this.botConfigurationService.updateSecuritySettings(payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('prompts')
  listPrompts(): PromptTemplate[] {
    return this.botConfigurationService.listPrompts();
  }

  @Roles('admin', 'operator')
  @Post('prompts')
  createPrompt(@Body() payload: CreatePromptTemplateDto) {
    return this.botConfigurationService.createPrompt(payload);
  }

  @Roles('admin', 'operator')
  @Put('prompts/:id')
  updatePrompt(
    @Param('id') promptId: string,
    @Body() payload: UpdatePromptTemplateDto,
  ) {
    return this.botConfigurationService.updatePrompt(promptId, payload);
  }

  @Roles('admin', 'operator')
  @Delete('prompts/:id')
  deletePrompt(@Param('id') promptId: string) {
    return this.botConfigurationService.deletePrompt(promptId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('tools')
  listTools(): InternalToolSettings[] {
    return this.botConfigurationService.listTools();
  }

  @Roles('admin', 'operator')
  @Post('tools')
  createTool(@Body() payload: CreateToolDto) {
    return this.botConfigurationService.createTool(payload);
  }

  @Roles('admin', 'operator')
  @Put('tools/:id')
  updateTool(@Param('id') toolId: string, @Body() payload: UpdateToolDto) {
    return this.botConfigurationService.updateTool(toolId, payload);
  }

  @Roles('admin', 'operator')
  @Delete('tools/:id')
  deleteTool(@Param('id') toolId: string) {
    return this.botConfigurationService.deleteTool(toolId);
  }
}