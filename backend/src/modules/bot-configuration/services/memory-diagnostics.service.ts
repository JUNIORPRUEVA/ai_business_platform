import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { DatabaseService } from '../../../common/database/database.service';
import { ClientMemoryEntity } from '../../ai_brain/entities/client-memory.entity';
import { MemoryCacheService } from '../../ai-engine/memory-cache.service';
import { ContactMemoryEntity } from '../../ai-engine/entities/contact-memory.entity';
import { ConversationMemoryEntity } from '../../ai-engine/entities/conversation-memory.entity';
import { ConversationSummaryEntity } from '../../ai-engine/entities/conversation-summary.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { ConversationEntity } from '../../conversations/entities/conversation.entity';
import { BotConfigurationService } from './bot-configuration.service';
import {
  MemoryDiagnosticsResponse,
  MemoryInfrastructureStatus,
} from '../types/memory-diagnostics.types';

@Injectable()
export class MemoryDiagnosticsService {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly databaseService: DatabaseService,
    private readonly memoryCacheService: MemoryCacheService,
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepository: Repository<ConversationEntity>,
    @InjectRepository(ConversationMemoryEntity)
    private readonly conversationMemoryRepository: Repository<ConversationMemoryEntity>,
    @InjectRepository(ContactMemoryEntity)
    private readonly contactMemoryRepository: Repository<ContactMemoryEntity>,
    @InjectRepository(ClientMemoryEntity)
    private readonly clientMemoryRepository: Repository<ClientMemoryEntity>,
    @InjectRepository(ConversationSummaryEntity)
    private readonly conversationSummaryRepository: Repository<ConversationSummaryEntity>,
  ) {}

  async getDiagnostics(companyId: string): Promise<MemoryDiagnosticsResponse> {
    const configuration = (await this.botConfigurationService.getConfiguration(companyId)).memory;
    const databaseHealth = this.databaseService.getHealth();
    const redisHealth = await this.memoryCacheService.getHealthReport();

    const [
      contacts,
      conversations,
      conversationMemoryActive,
      conversationMemoryCompacted,
      clientFacts,
      operationalMemory,
      summaries,
      lastConversationMemory,
      lastSummary,
    ] = await Promise.all([
      this.contactsRepository.count({ where: { companyId } }),
      this.conversationsRepository.count({ where: { companyId } }),
      this.conversationMemoryRepository.count({
        where: { companyId, compactedAt: IsNull() },
      }),
      this.conversationMemoryRepository.count({
        where: { companyId, compactedAt: Not(IsNull()) },
      }),
      this.clientMemoryRepository.count({ where: { companyId } }),
      this.contactMemoryRepository.count({ where: { companyId } }),
      this.conversationSummaryRepository.count({ where: { companyId } }),
      this.conversationMemoryRepository.findOne({
        where: { companyId },
        order: { createdAt: 'DESC' },
      }),
      this.conversationSummaryRepository.findOne({
        where: { companyId },
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const postgresStatus: MemoryInfrastructureStatus = {
      state:
        configuration.usePostgreSql && databaseHealth.configured
          ? 'healthy'
          : configuration.usePostgreSql
              ? 'offline'
              : 'degraded',
      configured: databaseHealth.configured,
      active: configuration.usePostgreSql && databaseHealth.configured,
      label: databaseHealth.configured
          ? 'PostgreSQL listo'
          : 'PostgreSQL sin configurar',
      detail: databaseHealth.configured
          ? `Source of truth en ${databaseHealth.settings.host}:${databaseHealth.settings.port}/${databaseHealth.settings.database}.`
          : 'La memoria persistente requiere variables de conexion PostgreSQL validas.',
    };

    const redisStatus: MemoryInfrastructureStatus = {
      state: configuration.useRedis ? redisHealth.state : 'degraded',
      configured: redisHealth.configured,
      active: configuration.useRedis && redisHealth.connected,
      label: configuration.useRedis
          ? redisHealth.connected
              ? 'Redis conectado'
              : 'Redis no disponible'
          : 'Redis deshabilitado por configuracion',
      detail: configuration.useRedis
          ? redisHealth.detail
          : 'La capa de cache e idempotencia esta desactivada en la configuracion del bot.',
    };

    const notes: string[] = [];
    if (!configuration.usePostgreSql) {
      notes.push(
        'La configuracion actual tiene PostgreSQL deshabilitado para memoria, aunque la arquitectura consolidada lo espera como capa principal.',
      );
    }
    if (configuration.useRedis && !redisHealth.connected) {
      notes.push(
        'Redis no esta respondiendo, por lo que la memoria seguira funcionando con PostgreSQL pero sin cache rapida ni locks de idempotencia.',
      );
    }
    if (configuration.summaryEnabled && summaries == 0) {
      notes.push(
        'Todavia no existen resumenes persistidos; eso es normal si aun no hubo suficiente trafico para disparar compactacion.',
      );
    }
    if (conversationMemoryActive == 0) {
      notes.push('No se detectaron eventos en conversation_memory para esta empresa.');
    }
    if (configuration.deduplicationEnabled) {
      notes.push(
        'La deduplicacion esta activa por eventId, messageId y hash de contenido en la capa de memoria.',
      );
    }

    const overallState = !postgresStatus.active
        ? 'offline'
        : configuration.useRedis && !redisStatus.active
            ? 'degraded'
            : conversationMemoryActive == 0
                ? 'degraded'
                : 'healthy';

    const overallSummary = conversationMemoryActive > 0
        ? 'La memoria persistente esta registrando contexto real del bot y el panel esta leyendo datos vivos por tenant.'
        : 'La arquitectura de memoria esta desplegada, pero aun no hay actividad persistida para este tenant o no llegaron mensajes al flujo productivo.';

    return {
      generatedAt: new Date().toISOString(),
      overallState,
      overallSummary,
      persistence: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
      features: {
        shortTerm: configuration.enableShortTermMemory,
        longTerm: configuration.enableLongTermMemory,
        operational: configuration.enableOperationalMemory,
        summaries: configuration.summaryEnabled,
        deduplication: configuration.deduplicationEnabled,
        pruning: configuration.pruningEnabled,
        debug: configuration.memoryDebugEnabled,
      },
      configuration: {
        recentMessageWindowSize: configuration.recentMessageWindowSize,
        summaryRefreshThreshold: configuration.summaryRefreshThreshold,
        memoryTtl: configuration.memoryTtl,
        useRedis: configuration.useRedis,
        usePostgreSql: configuration.usePostgreSql,
        automaticSummarization: configuration.automaticSummarization,
      },
      counters: {
        contacts,
        conversations,
        conversationMemoryActive,
        conversationMemoryCompacted,
        clientFacts,
        operationalMemory,
        summaries,
      },
      activity: {
        lastConversationMemoryAt: lastConversationMemory?.createdAt.toISOString() ?? null,
        lastSummaryAt: lastSummary?.updatedAt.toISOString() ?? null,
      },
      notes,
    };
  }
}
