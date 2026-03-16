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
}
