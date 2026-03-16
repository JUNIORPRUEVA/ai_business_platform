import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ContactEntity } from '../contacts/entities/contact.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoryEntity } from './entities/memory.entity';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(MemoryEntity)
    private readonly memoryRepository: Repository<MemoryEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
  ) {}

  list(companyId: string) {
    return this.memoryRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async get(companyId: string, id: string) {
    const memory = await this.memoryRepository.findOne({ where: { id, companyId } });
    if (!memory) throw new NotFoundException('Memory entry not found.');
    return memory;
  }

  async create(companyId: string, dto: CreateMemoryDto) {
    const contact = await this.contactsRepository.findOne({
      where: { id: dto.contactId, companyId },
    });
    if (!contact) throw new NotFoundException('Contact not found.');

    const entity = this.memoryRepository.create({
      companyId,
      contactId: contact.id,
      type: dto.type,
      content: dto.content,
    });

    return this.memoryRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateMemoryDto) {
    const memory = await this.get(companyId, id);
    const merged = this.memoryRepository.merge(memory, dto);
    return this.memoryRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.memoryRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Memory entry not found.');
    return { deleted: true } as const;
  }

  async listForContact(companyId: string, contactId: string) {
    return this.memoryRepository.find({
      where: { companyId, contactId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
