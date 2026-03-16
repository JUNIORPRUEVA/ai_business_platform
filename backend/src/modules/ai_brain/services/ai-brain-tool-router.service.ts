import { Injectable } from '@nestjs/common';

import { ToolRunnerService, ToolRequestEnvelope } from '../../ai-engine/tool-runner.service';
import { ToolEntity } from '../../tools/entities/tool.entity';

@Injectable()
export class AiBrainToolRouterService {
  constructor(private readonly toolRunnerService: ToolRunnerService) {}

  tryParse(content: string, activeTools: ToolEntity[]): ToolRequestEnvelope | null {
    let trimmed = content.trim();

    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }

    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as ToolRequestEnvelope;
      if (!parsed.tool?.trim()) {
        return null;
      }

      const isAllowed = activeTools.some(
        (tool) => tool.active && (tool.name === parsed.tool || tool.id === parsed.tool),
      );

      return isAllowed ? parsed : null;
    } catch {
      return null;
    }
  }

  run(params: {
    companyId: string;
    botId: string;
    contactId: string;
    request: ToolRequestEnvelope;
  }) {
    return this.toolRunnerService.run(params);
  }
}