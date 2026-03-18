import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'whatsapp_channel_configs' })
@Index(['companyId'])
@Index(['companyId', 'provider'], { unique: true })
@Index(['companyId', 'instanceName'])
export class WhatsappChannelConfigEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text', default: 'evolution' })
  provider!: 'evolution';

  @Column({ type: 'text', name: 'evolution_server_url' })
  evolutionServerUrl!: string;

  @Column({ type: 'text', name: 'evolution_api_key_encrypted' })
  evolutionApiKeyEncrypted!: string;

  @Column({ type: 'text', name: 'instance_name' })
  instanceName!: string;

  @Column({ type: 'text', name: 'instance_phone', nullable: true })
  instancePhone!: string | null;

  @Column({ type: 'text', name: 'instance_status', default: 'disconnected' })
  instanceStatus!: string;

  @Column({ type: 'boolean', name: 'webhook_enabled', default: true })
  webhookEnabled!: boolean;

  @Column({ type: 'text', name: 'webhook_url', nullable: true })
  webhookUrl!: string | null;

  @Column({ type: 'boolean', name: 'webhook_by_events', default: false })
  webhookByEvents!: boolean;

  @Column({ type: 'boolean', name: 'webhook_base64', default: false })
  webhookBase64!: boolean;

  @Column({ type: 'jsonb', name: 'webhook_events_json', default: () => `'[]'::jsonb` })
  webhookEventsJson!: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', name: 'last_sync_at', nullable: true })
  lastSyncAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}