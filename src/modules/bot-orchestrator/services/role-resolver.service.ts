import { Injectable } from '@nestjs/common';

import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { RoleResolutionResult } from '../types/bot-orchestrator.types';

@Injectable()
export class RoleResolverService {
  resolve(payload: ProcessIncomingMessageDto): RoleResolutionResult {
    const metadataRole = this.readMetadataRole(payload.metadata);

    if (metadataRole) {
      return {
        detectedRole: metadataRole,
        confidence: 0.96,
        source: 'metadata',
      };
    }

    const senderName = payload.senderName?.toLowerCase() ?? '';
    const message = payload.message.toLowerCase();

    if (/(owner|proprietario|proprietário)/.test(senderName)) {
      return { detectedRole: 'owner', confidence: 0.88, source: 'senderName' };
    }

    if (/(manager|gerente|director|diretor|operations)/.test(senderName)) {
      return { detectedRole: 'manager', confidence: 0.84, source: 'senderName' };
    }

    if (/(finance|billing|financeiro)/.test(senderName + ' ' + message)) {
      return { detectedRole: 'finance', confidence: 0.8, source: 'message' };
    }

    if (/(operator|atendente|support agent)/.test(senderName + ' ' + message)) {
      return { detectedRole: 'operator', confidence: 0.78, source: 'message' };
    }

    if (/(cashier|caixa|pdv)/.test(senderName + ' ' + message)) {
      return { detectedRole: 'cashier', confidence: 0.76, source: 'message' };
    }

    if (payload.channel.toLowerCase() === 'whatsapp') {
      return { detectedRole: 'lead', confidence: 0.58, source: 'default' };
    }

    return { detectedRole: 'unknown', confidence: 0.32, source: 'default' };
  }

  private readMetadataRole(
    metadata?: Record<string, unknown>,
  ): RoleResolutionResult['detectedRole'] | null {
    const rawValue = metadata?.['role'];

    if (typeof rawValue !== 'string') {
      return null;
    }

    const value = rawValue.toLowerCase();

    if (
      value === 'unknown' ||
      value === 'lead' ||
      value === 'customer' ||
      value === 'owner' ||
      value === 'manager' ||
      value === 'operator' ||
      value === 'cashier' ||
      value === 'finance'
    ) {
      return value;
    }

    return null;
  }
}