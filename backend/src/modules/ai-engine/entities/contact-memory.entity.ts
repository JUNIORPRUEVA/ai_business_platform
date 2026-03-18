import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'contact_memory' })
@Index(['companyId'])
@Index(['companyId', 'contactId'])
@Index(['companyId', 'contactId', 'key'])
export class ContactMemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'uuid', name: 'conversation_id', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'text', name: 'state_type', default: 'operational' })
  stateType!: string;

  @Column({ type: 'jsonb', name: 'metadata_json', default: () => `'{}'::jsonb` })
  metadataJson!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
