import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type MessageSender = 'user' | 'bot' | 'client';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';

@Entity({ name: 'messages' })
@Index(['conversationId'])
export class MessageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'text' })
  sender!: MessageSender;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', default: 'text' })
  type!: MessageType;

  @Column({ type: 'text', name: 'media_url', nullable: true })
  mediaUrl!: string | null;

  @Column({ type: 'integer', nullable: true })
  duration!: number | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;
}
