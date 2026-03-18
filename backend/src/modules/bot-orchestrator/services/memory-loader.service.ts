import { Injectable } from '@nestjs/common';

import {
  BotDetectedIntent,
  BotDetectedRole,
  BotRuntimeConfiguration,
  LoadedMemoryBundle,
  LoadedMemoryItem,
} from '../types/bot-orchestrator.types';

@Injectable()
export class MemoryLoaderService {
  loadAll(params: {
    conversationId: string;
    senderId: string;
    detectedIntent: BotDetectedIntent;
    detectedRole: BotDetectedRole;
    configuration: BotRuntimeConfiguration;
  }): LoadedMemoryBundle {
    const shortTerm = this.loadShortTermMemory(params.senderId, params.detectedIntent);
    const longTerm = this.loadLongTermMemory(params.detectedIntent, params.detectedRole);
    const operational = this.loadOperationalMemory(params.detectedIntent, params.configuration);

    return {
      shortTerm,
      longTerm,
      operational,
      combined: [...shortTerm, ...longTerm, ...operational]
        .sort((left, right) => right.relevanceScore - left.relevanceScore)
        .slice(0, 6),
    };
  }

  private loadShortTermMemory(
    senderId: string,
    detectedIntent: BotDetectedIntent,
  ): LoadedMemoryItem[] {
    const items: LoadedMemoryItem[] = [
      {
        id: `stm-${senderId}-01`,
        scope: 'shortTerm',
        title: 'Recent sender interaction',
        content:
          'The same sender interacted recently and expects continuity instead of a cold restart.',
        relevanceScore: 0.79,
      },
    ];

    if (detectedIntent === 'product_question' || detectedIntent === 'catalog_search') {
      items.push({
        id: `stm-${senderId}-02`,
        scope: 'shortTerm',
        title: 'Catalog follow-up',
        content:
          'Previous exchange suggested the sender wants concrete product facts, variants, and availability instead of generic marketing.',
        relevanceScore: 0.93,
      });
    }

    return items;
  }

  private loadLongTermMemory(
    detectedIntent: BotDetectedIntent,
    detectedRole: BotDetectedRole,
  ): LoadedMemoryItem[] {
    const items: LoadedMemoryItem[] = [
      {
        id: 'ltm-001',
        scope: 'longTerm',
        title: 'Enterprise tone policy',
        content:
          'Responses must remain concise, operationally safe, and grounded in approved business data.',
        relevanceScore: 0.76,
      },
    ];

    if (detectedIntent === 'product_question' || detectedIntent === 'catalog_search') {
      items.push({
        id: 'ltm-002',
        scope: 'longTerm',
        title: 'Product knowledge grounding',
        content:
          'When answering about products, prefer catalog facts, SKU metadata, supported modules, and declared limitations. Do not invent unavailable features.',
        relevanceScore: 0.97,
      });
    }

    if (detectedRole === 'finance' || detectedIntent === 'billing_question') {
      items.push({
        id: 'ltm-003',
        scope: 'longTerm',
        title: 'Billing posture',
        content:
          'Billing replies must stay factual, avoid settlement promises, and escalate disputed balances when necessary.',
        relevanceScore: 0.9,
      });
    }

    return items;
  }

  private loadOperationalMemory(
    detectedIntent: BotDetectedIntent,
    configuration: BotRuntimeConfiguration,
  ): LoadedMemoryItem[] {
    const items: LoadedMemoryItem[] = [
      {
        id: 'opm-001',
        scope: 'operational',
        title: 'Current autonomy mode',
        content: `Runtime is operating in ${configuration.autonomyLevel} autonomy mode with fallback set to ${configuration.fallbackStrategy}.`,
        relevanceScore: 0.81,
      },
    ];

    if (detectedIntent === 'human_handoff') {
      items.push({
        id: 'opm-002',
        scope: 'operational',
        title: 'Escalation rule',
        content:
          'Any explicit request for a human operator must be honored without forcing automated loops.',
        relevanceScore: 0.99,
      });
    }

    if (detectedIntent === 'configuration_request') {
      items.push({
        id: 'opm-003',
        scope: 'operational',
        title: 'Admin boundary',
        content:
          'Configuration changes require authenticated admin flows; the orchestrator should not apply runtime changes directly from chat.',
        relevanceScore: 0.94,
      });
    }

    return items;
  }
}