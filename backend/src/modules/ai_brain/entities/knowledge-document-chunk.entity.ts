import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'knowledge_document_chunks' })
@Index(['companyId'])
@Index(['companyId', 'botId'])
@Index(['companyId', 'documentId'])
export class KnowledgeDocumentChunkEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'bot_id', nullable: true })
  botId!: string | null;

  @Column({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  @Column({ type: 'integer', name: 'chunk_index' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'integer', name: 'token_count', default: 0 })
  tokenCount!: number;

  @Column({ type: 'text', default: 'ready' })
  status!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
