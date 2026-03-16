import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationEntity } from './entities/automation.entity';

@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(AutomationEntity)
    private readonly automationsRepository: Repository<AutomationEntity>,
  ) {}

  list(companyId: string) {
    return this.automationsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const automation = await this.automationsRepository.findOne({ where: { id, companyId } });
    if (!automation) throw new NotFoundException('Automation not found.');
    return automation;
  }

  create(companyId: string, dto: CreateAutomationDto) {
    const entity = this.automationsRepository.create({
      companyId,
      trigger: dto.trigger,
      action: dto.action,
      config: dto.config ?? {},
      status: dto.status ?? 'active',
    });
    return this.automationsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateAutomationDto) {
    const automation = await this.get(companyId, id);
    const merged = this.automationsRepository.merge(automation, {
      ...dto,
      config: dto.config ?? automation.config,
    });
    return this.automationsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.automationsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Automation not found.');
    return { deleted: true } as const;
  }
}
