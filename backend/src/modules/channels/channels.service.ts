import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelEntity } from './entities/channel.entity';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelsRepository: Repository<ChannelEntity>,
  ) {}

  list(companyId: string) {
    return this.channelsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const channel = await this.channelsRepository.findOne({
      where: { id, companyId },
    });
    if (!channel) throw new NotFoundException('Channel not found.');
    return channel;
  }

  create(companyId: string, dto: CreateChannelDto) {
    const entity = this.channelsRepository.create({
      companyId,
      type: dto.type,
      name: dto.name,
      status: dto.status ?? 'active',
      config: dto.config ?? {},
    });
    return this.channelsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateChannelDto) {
    const channel = await this.get(companyId, id);
    const merged = this.channelsRepository.merge(channel, {
      ...dto,
      config: dto.config ?? channel.config,
    });
    return this.channelsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.channelsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Channel not found.');
    return { deleted: true } as const;
  }

  async getByIdUnsafe(id: string): Promise<ChannelEntity> {
    const channel = await this.channelsRepository.findOne({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found.');
    return channel;
  }
}
