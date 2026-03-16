import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'client_memories' })
@Index(['companyId'])
@Index(['companyId', 'contactId'])
@Index(['companyId', 'contactId', 'key'])
export class ClientMemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'text', default: 'profile' })
  category!: string;

  @Column({ type: 'double precision', default: 0.6 })
  confidence!: number;

  @Column({ type: 'uuid', name: 'conversation_id', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}