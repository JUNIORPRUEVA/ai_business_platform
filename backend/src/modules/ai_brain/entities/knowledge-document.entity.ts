import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'knowledge_documents' })
@Index(['companyId'])
@Index(['companyId', 'botId'])
export class KnowledgeDocumentEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'bot_id', nullable: true })
  botId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'text', default: 'document' })
  kind!: string;

  @Column({ type: 'text', name: 'content_type', nullable: true })
  contentType!: string | null;

  @Column({ type: 'bigint', nullable: true })
  size!: string | null;

  @Column({ type: 'text', default: 'ready' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}