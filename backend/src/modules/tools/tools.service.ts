import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolEntity } from './entities/tool.entity';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(ToolEntity)
    private readonly toolsRepository: Repository<ToolEntity>,
  ) {}

  list(companyId: string) {
    return this.toolsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const tool = await this.toolsRepository.findOne({ where: { id, companyId } });
    if (!tool) throw new NotFoundException('Tool not found.');
    return tool;
  }

  create(companyId: string, dto: CreateToolDto) {
    const entity = this.toolsRepository.create({
      companyId,
      botId: dto.botId ?? null,
      name: dto.name,
      type: dto.type,
      config: dto.config ?? {},
      active: dto.active ?? true,
    });
    return this.toolsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateToolDto) {
    const tool = await this.get(companyId, id);
    const merged = this.toolsRepository.merge(tool, {
      ...dto,
      config: dto.config ?? tool.config,
    });
    return this.toolsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.toolsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Tool not found.');
    return { deleted: true } as const;
  }
}
