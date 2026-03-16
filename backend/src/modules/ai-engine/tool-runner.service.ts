import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ContactsService } from '../contacts/contacts.service';
import { ToolsService } from '../tools/tools.service';
import { ToolEntity } from '../tools/entities/tool.entity';
import { MemoryService } from './memory.service';

export interface ToolRequestEnvelope {
  tool: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class ToolRunnerService {
  private readonly logger = new Logger(ToolRunnerService.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly contactsService: ContactsService,
    private readonly memoryService: MemoryService,
    @InjectRepository(ToolEntity)
    private readonly toolsRepository: Repository<ToolEntity>,
  ) {}

  async run(params: {
    companyId: string;
    botId?: string;
    contactId: string;
    request: ToolRequestEnvelope;
  }): Promise<{ tool: string; ok: boolean; result: unknown }> {
    const toolName = params.request.tool?.trim();
    if (!toolName) {
      throw new BadRequestException('Tool request missing tool name.');
    }

    const tool = await this.findTool(params.companyId, params.botId, toolName);
    const data = params.request.data ?? {};

    switch (tool.type) {
      case 'create_lead':
      case 'lead:create':
      case 'create_lead_v1':
        return this.runCreateLead({ companyId: params.companyId, contactId: params.contactId, data, toolName });
      default:
        this.logger.warn(`Unsupported tool type: ${tool.type} (name=${tool.name})`);
        return { tool: toolName, ok: false, result: { error: `Unsupported tool type: ${tool.type}` } };
    }
  }

  private async findTool(companyId: string, botId: string | undefined, toolName: string): Promise<ToolEntity> {
    // Prefer bot-scoped tool if available, fallback to company-wide tool.
    const botScoped = botId
      ? await this.toolsRepository.findOne({
          where: { companyId, botId, name: toolName },
          order: { createdAt: 'DESC' },
        })
      : null;

    if (botScoped) return botScoped;

    const companyWide = await this.toolsRepository.findOne({
      where: { companyId, botId: IsNull(), name: toolName },
      order: { createdAt: 'DESC' },
    });

    if (companyWide) return companyWide;

    // Final fallback: treat tool name as id
    try {
      return await this.toolsService.get(companyId, toolName);
    } catch {
      throw new NotFoundException(`Tool not found: ${toolName}`);
    }
  }

  private async runCreateLead(params: {
    companyId: string;
    contactId: string;
    data: Record<string, unknown>;
    toolName: string;
  }): Promise<{ tool: string; ok: boolean; result: unknown }> {
    const name = typeof params.data['name'] === 'string' ? (params.data['name'] as string).trim() : '';
    const phone = typeof params.data['phone'] === 'string' ? (params.data['phone'] as string).trim() : '';

    if (name) {
      await this.contactsService.update(params.companyId, params.contactId, { name });
      await this.memoryService.setContactMemory({ contactId: params.contactId, key: 'nombre_cliente', value: name });
    }

    if (phone) {
      await this.memoryService.setContactMemory({ contactId: params.contactId, key: 'telefono', value: phone });
    }

    // Basic interest capture
    const interest = typeof params.data['interest'] === 'string' ? (params.data['interest'] as string).trim() : '';
    if (interest) {
      await this.memoryService.setContactMemory({ contactId: params.contactId, key: 'interes_producto', value: interest });
    }

    return {
      tool: params.toolName,
      ok: true,
      result: {
        leadCreated: true,
        contactId: params.contactId,
        stored: {
          name: name || undefined,
          phone: phone || undefined,
          interest: interest || undefined,
        },
      },
    };
  }
}
