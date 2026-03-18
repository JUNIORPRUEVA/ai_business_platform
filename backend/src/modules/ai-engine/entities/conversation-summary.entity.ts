import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'conversation_summaries' })
@Index(['companyId'])
@Index(['companyId', 'contactId'])
@Index(['companyId', 'conversationId'])
export class ConversationSummaryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'text', name: 'summary_text' })
  summaryText!: string;

  @Column({ type: 'jsonb', name: 'key_facts_json', default: () => `'[]'::jsonb` })
  keyFactsJson!: Array<{ key: string; value: string; category: string }>;

  @Column({ type: 'uuid', name: 'last_message_id', nullable: true })
  lastMessageId!: string | null;

  @Column({ type: 'integer', name: 'summary_version', default: 1 })
  summaryVersion!: number;

  @Column({ type: 'jsonb', name: 'metadata_json', default: () => `'{}'::jsonb` })
  metadataJson!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}