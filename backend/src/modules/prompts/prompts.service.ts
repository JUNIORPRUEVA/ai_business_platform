import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptEntity, PromptType } from './entities/prompt.entity';

@Injectable()
export class PromptsService {
  constructor(
    @InjectRepository(PromptEntity)
    private readonly promptsRepository: Repository<PromptEntity>,
  ) {}

  list(companyId: string) {
    return this.promptsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const prompt = await this.promptsRepository.findOne({ where: { id, companyId } });
    if (!prompt) throw new NotFoundException('Prompt not found.');
    return prompt;
  }

  create(companyId: string, dto: CreatePromptDto) {
    const entity = this.promptsRepository.create({
      companyId,
      name: dto.name,
      type: dto.type,
      content: dto.content,
      active: dto.active ?? true,
    });
    return this.promptsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdatePromptDto) {
    const prompt = await this.get(companyId, id);
    const merged = this.promptsRepository.merge(prompt, dto);
    return this.promptsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.promptsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Prompt not found.');
    return { deleted: true } as const;
  }

  async getActiveSystemPrompt(companyId: string): Promise<string | null> {
    const prompt = await this.promptsRepository.findOne({
      where: { companyId, type: 'system' as PromptType, active: true },
      order: { createdAt: 'DESC' },
    });
    return prompt?.content ?? null;
  }
}
