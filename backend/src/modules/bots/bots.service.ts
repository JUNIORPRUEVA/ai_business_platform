import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotEntity } from './entities/bot.entity';

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(BotEntity)
    private readonly botsRepository: Repository<BotEntity>,
  ) {}

  list(companyId: string) {
    return this.botsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const bot = await this.botsRepository.findOne({ where: { id, companyId } });
    if (!bot) throw new NotFoundException('Bot not found.');
    return bot;
  }

  create(companyId: string, dto: CreateBotDto) {
    const entity = this.botsRepository.create({
      companyId,
      name: dto.name,
      model: dto.model ?? 'gpt-4o-mini',
      temperature: dto.temperature ?? 0.2,
      status: dto.status ?? 'active',
    });
    return this.botsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateBotDto) {
    const bot = await this.get(companyId, id);
    const merged = this.botsRepository.merge(bot, dto);
    return this.botsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.botsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Bot not found.');
    return { deleted: true } as const;
  }

  async getDefaultActiveBot(companyId: string): Promise<BotEntity> {
    const bot = await this.botsRepository.findOne({
      where: { companyId, status: 'active' },
      order: { createdAt: 'ASC' },
    });
    if (!bot) {
      throw new NotFoundException('No active bot configured for this company.');
    }
    return bot;
  }
}
