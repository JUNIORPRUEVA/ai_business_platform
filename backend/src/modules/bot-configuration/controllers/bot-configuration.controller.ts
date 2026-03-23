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
import { UpdateIntegrationsSettingsDto } from '../dto/update-integrations-settings.dto';
import { UpdateMemorySettingsDto } from '../dto/update-memory-settings.dto';
import { UpdateOpenAiSettingsDto } from '../dto/update-openai-settings.dto';
import { UpdateOrchestratorSettingsDto } from '../dto/update-orchestrator-settings.dto';
import { UpdatePromptTemplateDto } from '../dto/update-prompt-template.dto';
import { UpdateSecuritySettingsDto } from '../dto/update-security-settings.dto';
import { TestOpenAiConnectionDto } from '../dto/test-openai-connection.dto';
import { UpdateToolDto } from '../dto/update-tool.dto';
import { UpdateWhatsappSettingsDto } from '../dto/update-whatsapp-settings.dto';
import { BotConfigurationService } from '../services/bot-configuration.service';
import { MemoryDiagnosticsService } from '../services/memory-diagnostics.service';
import { BotConfigurationBundle, PromptTemplate, InternalToolSettings } from '../types/bot-configuration.types';
import { MemoryDiagnosticsResponse } from '../types/memory-diagnostics.types';

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('bot-configuration')
export class BotConfigurationController {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly memoryDiagnosticsService: MemoryDiagnosticsService,
  ) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  getConfiguration(@CurrentUser() user: AuthUser): Promise<BotConfigurationBundle> {
    return this.botConfigurationService.getConfiguration(user.companyId);
  }

  @Roles('admin', 'operator')
  @Put('general')
  updateGeneral(@CurrentUser() user: AuthUser, @Body() payload: UpdateGeneralSettingsDto) {
    return this.botConfigurationService.updateGeneralSettings(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('evolution')
  updateEvolution(@CurrentUser() user: AuthUser, @Body() payload: UpdateEvolutionSettingsDto) {
    return this.botConfigurationService.updateEvolutionSettings(user.companyId, payload);
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
  updateOpenAi(@CurrentUser() user: AuthUser, @Body() payload: UpdateOpenAiSettingsDto) {
    return this.botConfigurationService.updateOpenAiSettings(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Post('openai/test')
  testOpenAiConnection(@CurrentUser() user: AuthUser, @Body() payload: TestOpenAiConnectionDto) {
    return this.botConfigurationService.testOpenAiConnection(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('integrations')
  updateIntegrations(@CurrentUser() user: AuthUser, @Body() payload: UpdateIntegrationsSettingsDto) {
    return this.botConfigurationService.updateIntegrationsSettings(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('whatsapp')
  updateWhatsapp(@CurrentUser() user: AuthUser, @Body() payload: UpdateWhatsappSettingsDto) {
    return this.botConfigurationService.updateWhatsappSettings(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('memory')
  updateMemory(@CurrentUser() user: AuthUser, @Body() payload: UpdateMemorySettingsDto) {
    return this.botConfigurationService.updateMemorySettings(user.companyId, payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('memory/diagnostics')
  getMemoryDiagnostics(
    @CurrentUser() user: AuthUser,
  ): Promise<MemoryDiagnosticsResponse> {
    return this.memoryDiagnosticsService.getDiagnostics(user.companyId);
  }

  @Roles('admin', 'operator')
  @Put('orchestrator')
  updateOrchestrator(@CurrentUser() user: AuthUser, @Body() payload: UpdateOrchestratorSettingsDto) {
    return this.botConfigurationService.updateOrchestratorSettings(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('security')
  updateSecurity(@CurrentUser() user: AuthUser, @Body() payload: UpdateSecuritySettingsDto) {
    return this.botConfigurationService.updateSecuritySettings(user.companyId, payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('prompts')
  listPrompts(@CurrentUser() user: AuthUser): Promise<PromptTemplate[]> {
    return this.botConfigurationService.listPrompts(user.companyId);
  }

  @Roles('admin', 'operator')
  @Post('prompts')
  createPrompt(@CurrentUser() user: AuthUser, @Body() payload: CreatePromptTemplateDto) {
    return this.botConfigurationService.createPrompt(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('prompts/:id')
  updatePrompt(
    @CurrentUser() user: AuthUser,
    @Param('id') promptId: string,
    @Body() payload: UpdatePromptTemplateDto,
  ) {
    return this.botConfigurationService.updatePrompt(user.companyId, promptId, payload);
  }

  @Roles('admin', 'operator')
  @Delete('prompts/:id')
  deletePrompt(@CurrentUser() user: AuthUser, @Param('id') promptId: string) {
    return this.botConfigurationService.deletePrompt(user.companyId, promptId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('tools')
  listTools(@CurrentUser() user: AuthUser): Promise<InternalToolSettings[]> {
    return this.botConfigurationService.listTools(user.companyId);
  }

  @Roles('admin', 'operator')
  @Post('tools')
  createTool(@CurrentUser() user: AuthUser, @Body() payload: CreateToolDto) {
    return this.botConfigurationService.createTool(user.companyId, payload);
  }

  @Roles('admin', 'operator')
  @Put('tools/:id')
  updateTool(@CurrentUser() user: AuthUser, @Param('id') toolId: string, @Body() payload: UpdateToolDto) {
    return this.botConfigurationService.updateTool(user.companyId, toolId, payload);
  }

  @Roles('admin', 'operator')
  @Delete('tools/:id')
  deleteTool(@CurrentUser() user: AuthUser, @Param('id') toolId: string) {
    return this.botConfigurationService.deleteTool(user.companyId, toolId);
  }
}
