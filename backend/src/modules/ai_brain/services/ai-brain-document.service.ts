import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { RegisterKnowledgeDocumentDto } from '../dto/register-knowledge-document.dto';
import { UpdateKnowledgeDocumentDto } from '../dto/update-knowledge-document.dto';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';

@Injectable()
export class AiBrainDocumentService {
  constructor(
    @InjectRepository(KnowledgeDocumentEntity)
    private readonly documentsRepository: Repository<KnowledgeDocumentEntity>,
    private readonly storageService: StorageService,
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
      status: 'ready',
      metadata: {
        source: 'manual-upload',
      },
    });

    return this.documentsRepository.save(entity);
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

  async get(companyId: string, id: string) {
    const document = await this.documentsRepository.findOne({ where: { id, companyId } });
    if (!document) {
      throw new NotFoundException('Knowledge document not found.');
    }
    return document;
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
}