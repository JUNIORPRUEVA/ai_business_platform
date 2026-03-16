import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LicenseService } from '../billing/license.service';
import { EvolutionService, EvolutionInstanceConnectionStatus } from '../evolution/evolution.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelEntity } from './entities/channel.entity';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelsRepository: Repository<ChannelEntity>,
    private readonly evolutionService: EvolutionService,
    private readonly licenseService: LicenseService,
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

  async create(companyId: string, dto: CreateChannelDto) {
    await this.licenseService.assertPlanLimit(companyId, 'channels');
    const entity = this.channelsRepository.create({
      companyId,
      type: dto.type,
      name: dto.name,
      status: dto.status ?? 'active',
      config: dto.config ?? {},
    });

    const saved = await this.channelsRepository.save(entity);

    if (saved.type === 'whatsapp') {
      const instanceName = this.buildInstanceName(companyId, saved.id);
      saved.instanceName = instanceName;
      saved.connectionStatus = 'connecting';
      await this.channelsRepository.save(saved);

      try {
        await this.evolutionService.createInstance({
          instanceName,
          qrcode: true,
        });

        await this.evolutionService.setWebhook({
          instanceName,
          url: this.evolutionService.buildWebhookUrl(saved.id),
          events: ['messages.upsert'],
        });

        saved.config = {
          ...saved.config,
          evolutionProvisioningStatus: 'ready',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Evolution error.';

        this.logger.warn(
          `Skipping Evolution provisioning for channel ${saved.id}: ${message}`,
        );

        saved.connectionStatus = 'disconnected';
        saved.config = {
          ...saved.config,
          evolutionProvisioningStatus: 'failed',
          evolutionProvisioningError: message,
        };
      }

      await this.channelsRepository.save(saved);
    }

    return saved;
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

  async getQrCode(companyId: string, id: string): Promise<{ instanceName: string; payload: unknown }> {
    const channel = await this.get(companyId, id);
    if (channel.type !== 'whatsapp') {
      throw new NotFoundException('Channel is not a WhatsApp channel.');
    }
    if (!channel.instanceName) {
      throw new NotFoundException('Channel has no Evolution instance configured.');
    }

    const payload = await this.evolutionService.getQrCode(channel.instanceName);
    return { instanceName: channel.instanceName, payload };
  }

  async refreshConnectionStatus(
    companyId: string,
    id: string,
  ): Promise<{ status: EvolutionInstanceConnectionStatus; raw: unknown }> {
    const channel = await this.get(companyId, id);
    if (channel.type !== 'whatsapp') {
      throw new NotFoundException('Channel is not a WhatsApp channel.');
    }
    if (!channel.instanceName) {
      throw new NotFoundException('Channel has no Evolution instance configured.');
    }

    const { status, raw } = await this.evolutionService.getInstanceStatus(channel.instanceName);
    channel.connectionStatus = status;
    await this.channelsRepository.save(channel);
    return { status, raw };
  }

  async disconnect(companyId: string, id: string): Promise<{ ok: true }> {
    const channel = await this.get(companyId, id);
    if (channel.type !== 'whatsapp') {
      throw new NotFoundException('Channel is not a WhatsApp channel.');
    }
    if (!channel.instanceName) {
      throw new NotFoundException('Channel has no Evolution instance configured.');
    }

    await this.evolutionService.logoutInstance(channel.instanceName);
    channel.connectionStatus = 'disconnected';
    await this.channelsRepository.save(channel);
    return { ok: true };
  }

  private buildInstanceName(companyId: string, channelId: string): string {
    const companyPart = companyId.replace(/-/g, '');
    const channelPart = channelId.replace(/-/g, '');
    return `company_${companyPart}_channel_${channelPart}`;
  }
}
