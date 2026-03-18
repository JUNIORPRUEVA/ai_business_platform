import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'whatsapp_chats' })
@Index(['companyId'])
@Index(['channelConfigId'])
@Index(['companyId', 'remoteJid'], { unique: true })
export class WhatsappChatEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'channel_config_id' })
  channelConfigId!: string;

  @Column({ type: 'text', name: 'remote_jid' })
  remoteJid!: string;

  @Column({ type: 'text', name: 'original_remote_jid', nullable: true })
  originalRemoteJid!: string | null;

  @Column({ type: 'text', name: 'raw_remote_jid', nullable: true })
  rawRemoteJid!: string | null;

  @Column({ type: 'text', name: 'canonical_remote_jid', nullable: true })
  canonicalRemoteJid!: string | null;

  @Column({ type: 'text', name: 'canonical_number', nullable: true })
  canonicalNumber!: string | null;

  @Column({ type: 'text', name: 'send_target', nullable: true })
  sendTarget!: string | null;

  @Column({ type: 'text', name: 'last_inbound_jid_type', nullable: true })
  lastInboundJidType!: string | null;

  @Column({ type: 'boolean', name: 'reply_target_unresolved', default: false })
  replyTargetUnresolved!: boolean;

  @Column({ type: 'text', name: 'push_name', nullable: true })
  pushName!: string | null;

  @Column({ type: 'text', name: 'profile_name', nullable: true })
  profileName!: string | null;

  @Column({ type: 'text', name: 'profile_picture_url', nullable: true })
  profilePictureUrl!: string | null;

  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ type: 'integer', name: 'unread_count', default: 0 })
  unreadCount!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}