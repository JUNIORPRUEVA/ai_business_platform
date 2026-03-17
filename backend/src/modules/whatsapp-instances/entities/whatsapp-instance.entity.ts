import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type WhatsappInstanceStatus =
  | 'created'
  | 'connecting'
  | 'connected'
  | 'disconnected';

@Entity({ name: 'whatsapp_instances' })
@Index(['tenantId'])
@Index(['tenantId', 'instanceName'])
@Index(['instanceName'], { unique: true })
export class WhatsappInstanceEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'text', name: 'instance_name' })
  instanceName!: string;

  @Column({ type: 'text', name: 'evolution_url', nullable: true })
  evolutionUrl!: string | null;

  @Column({ type: 'text', name: 'evolution_api_key', nullable: true })
  evolutionApiKey!: string | null;

  @Column({ type: 'text', default: 'created' })
  status!: WhatsappInstanceStatus;

  @Column({ type: 'text', name: 'qr_code', nullable: true })
  qrCode!: string | null;

  @Column({ type: 'text', name: 'phone_number', nullable: true })
  phoneNumber!: string | null;

  @Column({ type: 'jsonb', name: 'session_data', nullable: true })
  sessionData!: Record<string, unknown> | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
