import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { MemoryCacheService } from './memory-cache.service';
import { UpsertContactMemoryInput } from './memory.types';
import { ContactMemoryEntity } from './entities/contact-memory.entity';

@Injectable()
export class ContactMemoryService {
  private readonly logger = new Logger(ContactMemoryService.name);

  constructor(
    @InjectRepository(ContactMemoryEntity)
    private readonly contactMemoryRepository: Repository<ContactMemoryEntity>,
    private readonly memoryCacheService: MemoryCacheService,
  ) {}

  async upsert(input: UpsertContactMemoryInput): Promise<ContactMemoryEntity> {
    const key = input.key.trim();
    const value = input.value.trim();
    const stateType = input.stateType?.trim() || 'operational';

    const existing = await this.contactMemoryRepository.findOne({
      where: {
        companyId: input.companyId,
        contactId: input.contactId,
        key,
        stateType,
        expiresAt: IsNull(),
      },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });

    if (existing) {
      existing.value = value;
      existing.conversationId = input.conversationId ?? existing.conversationId;
      existing.metadataJson = {
        ...existing.metadataJson,
        ...(input.metadataJson ?? {}),
      };
      existing.expiresAt = input.expiresAt ?? existing.expiresAt;
      const saved = await this.contactMemoryRepository.save(existing);
      await this.memoryCacheService.delete(
        this.memoryCacheService.operationalKey(input.companyId, input.contactId),
      );
      this.logger.debug(`Operational memory updated for contact ${input.contactId}.`);
      return saved;
    }

    const created = this.contactMemoryRepository.create({
      companyId: input.companyId,
      contactId: input.contactId,
      conversationId: input.conversationId ?? null,
      key,
      value,
      stateType,
      metadataJson: input.metadataJson ?? {},
      expiresAt: input.expiresAt ?? null,
    });

    const saved = await this.contactMemoryRepository.save(created);
    await this.memoryCacheService.delete(
      this.memoryCacheService.operationalKey(input.companyId, input.contactId),
    );
    this.logger.debug(`Operational memory stored for contact ${input.contactId}.`);
    return saved;
  }

  async list(companyId: string, contactId: string): Promise<ContactMemoryEntity[]> {
    const cacheKey = this.memoryCacheService.operationalKey(companyId, contactId);
    const cached = await this.memoryCacheService.getJson<ContactMemoryEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const records = await this.contactMemoryRepository.find({
      where: { companyId, contactId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 100,
    });

    await this.memoryCacheService.setJson(cacheKey, records, 600);
    return records;
  }

  async getMap(companyId: string, contactId: string): Promise<Record<string, string>> {
    const records = await this.list(companyId, contactId);
    const map: Record<string, string> = {};
    for (const record of records) {
      if (map[record.key] === undefined) {
        map[record.key] = record.value;
      }
    }

    return map;
  }

  async updateManualOperationalNote(companyId: string, contactId: string, id: string, title?: string, content?: string): Promise<ContactMemoryEntity> {
    const existing = await this.contactMemoryRepository.findOne({
      where: { id, companyId, contactId, stateType: 'manual_note' },
    });

    if (!existing) {
      throw new NotFoundException(`Operational memory ${id} not found.`);
    }

    existing.value = content?.trim() || existing.value;
    existing.metadataJson = {
      ...existing.metadataJson,
      title: title?.trim() || (existing.metadataJson['title'] as string | undefined) || existing.key,
    };
    const saved = await this.contactMemoryRepository.save(existing);
    await this.memoryCacheService.delete(this.memoryCacheService.operationalKey(companyId, contactId));
    return saved;
  }

  async deleteManualOperationalNote(companyId: string, contactId: string, id: string): Promise<void> {
    await this.contactMemoryRepository.delete({ id, companyId, contactId, stateType: 'manual_note' });
    await this.memoryCacheService.delete(this.memoryCacheService.operationalKey(companyId, contactId));
  }
}