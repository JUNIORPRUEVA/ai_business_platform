import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptEntity, PromptType } from './entities/prompt.entity';

@Injectable()
export class PromptsService {
  private sanitizePromptContent(content: string): string {
    return content
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/seguimos con/gi, 'continua la conversacion sobre')
      .replace(/¿quieres que te recomiende algo\?/gi, '')
      .replace(/\?quieres que te recomiende algo\?/gi, '')
      .replace(/nunca reformules la pregunta del cliente como respuesta/gi, '')
      .trim();
  }

  private sanitizePrompt(prompt: PromptEntity): PromptEntity {
    return {
      ...prompt,
      content: this.sanitizePromptContent(prompt.content),
    };
  }

  constructor(
    @InjectRepository(PromptEntity)
    private readonly promptsRepository: Repository<PromptEntity>,
  ) {}

  async list(companyId: string) {
    const prompts = await this.promptsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    return prompts.map((prompt) => this.sanitizePrompt(prompt));
  }

  async listActive(companyId: string) {
    const prompts = await this.promptsRepository.find({
      where: { companyId, active: true },
      order: { createdAt: 'DESC' },
    });
    return prompts.map((prompt) => this.sanitizePrompt(prompt));
  }

  async get(companyId: string, id: string) {
    const prompt = await this.promptsRepository.findOne({ where: { id, companyId } });
    if (!prompt) throw new NotFoundException('Prompt not found.');
    return this.sanitizePrompt(prompt);
  }

  create(companyId: string, dto: CreatePromptDto) {
    const entity = this.promptsRepository.create({
      companyId,
      name: dto.name,
      type: dto.type,
      content: this.sanitizePromptContent(dto.content),
      active: dto.active ?? true,
    });
    return this.promptsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdatePromptDto) {
    const prompt = await this.get(companyId, id);
    const merged = this.promptsRepository.merge(prompt, {
      ...dto,
      content: dto.content == null ? prompt.content : this.sanitizePromptContent(dto.content),
    });
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
    return prompt ? this.sanitizePromptContent(prompt.content) : null;
  }
}
