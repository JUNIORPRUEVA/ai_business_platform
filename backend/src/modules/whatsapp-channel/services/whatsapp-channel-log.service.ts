import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WhatsappChannelLogEntity } from '../entities/whatsapp-channel-log.entity';

@Injectable()
export class WhatsappChannelLogService {
  constructor(
    @InjectRepository(WhatsappChannelLogEntity)
    private readonly logsRepository: Repository<WhatsappChannelLogEntity>,
  ) {}

  async create(params: {
    companyId: string;
    instanceName?: string | null;
    direction: 'incoming_webhook' | 'outgoing_api';
    eventName: string;
    endpointCalled?: string | null;
    requestPayloadJson?: Record<string, unknown>;
    responsePayloadJson?: Record<string, unknown>;
    httpStatus?: number | null;
    success: boolean;
    errorMessage?: string | null;
  }): Promise<WhatsappChannelLogEntity> {
    const entity = this.logsRepository.create({
      companyId: params.companyId,
      instanceName: params.instanceName ?? null,
      direction: params.direction,
      eventName: params.eventName,
      endpointCalled: params.endpointCalled ?? null,
      requestPayloadJson: params.requestPayloadJson ?? {},
      responsePayloadJson: params.responsePayloadJson ?? {},
      httpStatus: params.httpStatus ?? null,
      success: params.success,
      errorMessage: params.errorMessage ?? null,
    });

    return this.logsRepository.save(entity);
  }

  list(companyId: string): Promise<WhatsappChannelLogEntity[]> {
    return this.logsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }
}