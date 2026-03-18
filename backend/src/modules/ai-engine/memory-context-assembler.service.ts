import { Injectable } from '@nestjs/common';

import { AssembledMemoryContext } from './memory.types';

@Injectable()
export class MemoryContextAssemblerService {
  assemble(params: {
    summaryText?: string | null;
    keyFacts: Array<{ key: string; value: string; category: string }>;
    operationalState: Array<{ key: string; value: string; metadataJson?: Record<string, unknown> }>;
    recentWindow: Array<{ role: string; content: string; source: string }>;
    incomingMessage?: string;
  }): string {
    const summarySection = params.summaryText?.trim()
      ? params.summaryText.trim()
      : 'Sin summary persistente todavía.';

    const factsSection = params.keyFacts.length > 0
      ? params.keyFacts.map((fact) => `- [${fact.category}] ${fact.key}: ${fact.value}`).join('\n')
      : '- Sin facts persistentes.';

    const operationalSection = params.operationalState.length > 0
      ? params.operationalState
          .map((item) => `- ${item.key}: ${item.value}`)
          .join('\n')
      : '- Sin estado operativo activo.';

    const recentSection = params.recentWindow.length > 0
      ? params.recentWindow.map((item) => `- ${item.role}/${item.source}: ${item.content}`).join('\n')
      : '- Sin ventana reciente.';

    return [
      '1. Summary persistente:',
      summarySection,
      '',
      '2. Key facts del cliente:',
      factsSection,
      '',
      '3. Estado operativo actual:',
      operationalSection,
      '',
      '4. Ventana reciente:',
      recentSection,
      '',
      '5. Mensaje nuevo entrante:',
      params.incomingMessage?.trim() || '- Sin mensaje entrante.',
    ].join('\n');
  }
}