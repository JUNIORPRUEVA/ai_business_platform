import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactEntity } from './entities/contact.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
  ) {}

  list(companyId: string) {
    return this.contactsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const contact = await this.contactsRepository.findOne({
      where: { id, companyId },
    });
    if (!contact) throw new NotFoundException('Contact not found.');
    return contact;
  }

  create(companyId: string, dto: CreateContactDto) {
    const entity = this.contactsRepository.create({
      companyId,
      name: dto.name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      tags: dto.tags ?? [],
    });
    return this.contactsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateContactDto) {
    const contact = await this.get(companyId, id);
    const merged = this.contactsRepository.merge(contact, {
      ...dto,
      tags: dto.tags ?? contact.tags,
    });
    return this.contactsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.contactsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Contact not found.');
    return { deleted: true } as const;
  }

  async findOrCreateByPhone(companyId: string, phone: string, name?: string | null) {
    const normalizedPhone = phone.trim();
    const existing = await this.contactsRepository.findOne({
      where: { companyId, phone: normalizedPhone },
    });

    if (existing) {
      if (name && !existing.name) {
        existing.name = name;
        return this.contactsRepository.save(existing);
      }
      return existing;
    }

    const created = this.contactsRepository.create({
      companyId,
      phone: normalizedPhone,
      name: name ?? null,
      email: null,
      tags: [],
    });

    return this.contactsRepository.save(created);
  }
}
