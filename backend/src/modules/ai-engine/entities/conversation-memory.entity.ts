import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type ConversationMemoryRole = 'system' | 'user' | 'assistant' | 'tool';
export type ConversationMemoryContentType = 'text' | 'json' | 'event';

@Entity({ name: 'conversation_memory' })
@Index(['companyId'])
@Index(['companyId', 'conversationId'])
@Index(['companyId', 'contactId'])
@Index(['companyId', 'conversationId', 'createdAt'])
export class ConversationMemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'text' })
  role!: ConversationMemoryRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', name: 'content_type', default: 'text' })
  contentType!: ConversationMemoryContentType;

  @Column({ type: 'jsonb', name: 'metadata_json', default: () => `'{}'::jsonb` })
  metadataJson!: Record<string, unknown>;

  @Column({ type: 'text', default: 'runtime' })
  source!: string;

  @Column({ type: 'uuid', name: 'message_id', nullable: true })
  messageId!: string | null;

  @Column({ type: 'text', name: 'event_id', nullable: true })
  eventId!: string | null;

  @Column({ type: 'text', name: 'content_hash' })
  contentHash!: string;

  @Column({ type: 'timestamptz', name: 'compacted_at', nullable: true })
  compactedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
