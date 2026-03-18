import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'whatsapp_channel_logs' })
@Index(['companyId'])
@Index(['companyId', 'createdAt'])
@Index(['companyId', 'instanceName'])
export class WhatsappChannelLogEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text', name: 'instance_name', nullable: true })
  instanceName!: string | null;

  @Column({ type: 'text' })
  direction!: 'incoming_webhook' | 'outgoing_api';

  @Column({ type: 'text', name: 'event_name' })
  eventName!: string;

  @Column({ type: 'text', name: 'endpoint_called', nullable: true })
  endpointCalled!: string | null;

  @Column({ type: 'jsonb', name: 'request_payload_json', default: () => `'{}'::jsonb` })
  requestPayloadJson!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'response_payload_json', default: () => `'{}'::jsonb` })
  responsePayloadJson!: Record<string, unknown>;

  @Column({ type: 'integer', name: 'http_status', nullable: true })
  httpStatus!: number | null;

  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;
}