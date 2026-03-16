import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type ConversationMemoryRole = 'system' | 'user' | 'assistant';

@Entity({ name: 'conversation_memory' })
@Index(['conversationId'])
export class ConversationMemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'text' })
  role!: ConversationMemoryRole;

  @Column({ type: 'text' })
  content!: string;
}
