import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { RegisterKnowledgeDocumentDto } from '../dto/register-knowledge-document.dto';
import { UpdateKnowledgeDocumentDto } from '../dto/update-knowledge-document.dto';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { KnowledgeIndexingJob } from '../types/knowledge-indexing.types';

@Injectable()
export class AiBrainDocumentService {
  constructor(
    @InjectRepository(KnowledgeDocumentEntity)
    private readonly documentsRepository: Repository<KnowledgeDocumentEntity>,
    private readonly storageService: StorageService,
    @InjectQueue('knowledge-indexing')
    private readonly knowledgeIndexingQueue: Queue<KnowledgeIndexingJob>,
  ) {}

  list(companyId: string, botId?: string) {
    return this.documentsRepository.find({
      where: {
        companyId,
        ...(botId ? { botId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  listAvailable(companyId: string, botId: string) {
    return this.documentsRepository
      .createQueryBuilder('document')
      .where('document.company_id = :companyId', { companyId })
      .andWhere('(document.bot_id IS NULL OR document.bot_id = :botId)', {
        botId,
      })
      .orderBy('document.created_at', 'DESC')
      .getMany();
  }

  async create(companyId: string, dto: RegisterKnowledgeDocumentDto) {
    const entity = this.documentsRepository.create({
      companyId,
      botId: dto.botId ?? null,
      name: dto.name.trim(),
      storageKey: dto.storageKey.trim(),
      kind: dto.kind?.trim() || 'document',
      contentType: dto.contentType?.trim() || null,
      size: dto.size !== undefined ? String(dto.size) : null,
      summary: dto.summary?.trim() || null,
      status: 'pending_index',
      metadata: {
        source: 'manual-upload',
      },
    });

    const saved = await this.documentsRepository.save(entity);
    await this.knowledgeIndexingQueue.add(
      'index-document',
      {
        companyId,
        documentId: saved.id,
      },
      {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return saved;
  }

  async update(companyId: string, id: string, dto: UpdateKnowledgeDocumentDto) {
    const document = await this.get(companyId, id);
    const merged = this.documentsRepository.merge(document, {
      name: dto.name?.trim() ?? document.name,
      botId: dto.botId ?? document.botId,
      summary: dto.summary?.trim() ?? document.summary,
      status: dto.status?.trim() ?? document.status,
    });
    return this.documentsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const document = await this.get(companyId, id);
    await this.documentsRepository.remove(document);
    return { deleted: true } as const;
  }

  async reindex(companyId: string, id: string) {
    const document = await this.get(companyId, id);
    document.status = 'pending_index';
    document.metadata = {
      ...(document.metadata ?? {}),
      indexing: {
        ...this.readObject(document.metadata?.['indexing']),
        reindexRequestedAt: new Date().toISOString(),
      },
    };
    await this.documentsRepository.save(document);
    await this.knowledgeIndexingQueue.add(
      'index-document',
      {
        companyId,
        documentId: document.id,
      },
      {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    return document;
  }

  async get(companyId: string, id: string) {
    const document = await this.documentsRepository.findOne({ where: { id, companyId } });
    if (!document) {
      throw new NotFoundException('Knowledge document not found.');
    }
    return document;
  }

  async patchMetadata(
    companyId: string,
    id: string,
    patch: Record<string, unknown>,
  ) {
    const document = await this.get(companyId, id);
    document.metadata = {
      ...(document.metadata ?? {}),
      ...patch,
    };
    return this.documentsRepository.save(document);
  }

  async createUploadTarget(params: {
    companyId: string;
    filename: string;
    contentType?: string;
    botId?: string;
  }) {
    const upload = await this.storageService.presignUpload({
      companyId: params.companyId,
      folder: 'documents',
      filename: params.botId
        ? `${params.botId}-${params.filename}`
        : params.filename,
      contentType: params.contentType,
    });

    return {
      ...upload,
      folder: 'documents',
    };
  }

  private readObject(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  }
}
