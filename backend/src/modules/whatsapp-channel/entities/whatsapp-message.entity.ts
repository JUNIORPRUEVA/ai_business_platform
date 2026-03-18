import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type WhatsappMessageDirection = 'inbound' | 'outbound';
export type WhatsappMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'system'
  | 'unknown';

@Entity({ name: 'whatsapp_messages' })
@Index(['companyId'])
@Index(['channelConfigId'])
@Index(['chatId'])
@Index(['companyId', 'remoteJid'])
@Index(['companyId', 'createdAt'])
@Index(['companyId', 'evolutionMessageId'])
export class WhatsappMessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'channel_config_id' })
  channelConfigId!: string;

  @Column({ type: 'uuid', name: 'chat_id' })
  chatId!: string;

  @Column({ type: 'text', name: 'evolution_message_id', nullable: true })
  evolutionMessageId!: string | null;

  @Column({ type: 'text', name: 'remote_jid' })
  remoteJid!: string;

  @Column({ type: 'boolean', name: 'from_me', default: false })
  fromMe!: boolean;

  @Column({ type: 'text' })
  direction!: WhatsappMessageDirection;

  @Column({ type: 'text', name: 'message_type', default: 'text' })
  messageType!: WhatsappMessageType;

  @Column({ type: 'text', name: 'text_body', nullable: true })
  textBody!: string | null;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  @Column({ type: 'text', name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'text', name: 'media_url', nullable: true })
  mediaUrl!: string | null;

  @Column({ type: 'text', name: 'media_storage_path', nullable: true })
  mediaStoragePath!: string | null;

  @Column({ type: 'text', name: 'media_original_name', nullable: true })
  mediaOriginalName!: string | null;

  @Column({ type: 'bigint', name: 'media_size_bytes', nullable: true })
  mediaSizeBytes!: string | null;

  @Column({ type: 'text', name: 'thumbnail_url', nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: 'jsonb', name: 'raw_payload_json', default: () => `'{}'::jsonb` })
  rawPayloadJson!: Record<string, unknown>;

  @Column({ type: 'text', default: 'received' })
  status!: string;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}