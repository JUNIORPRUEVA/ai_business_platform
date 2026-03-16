import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type MemoryType = 'short_term' | 'long_term' | 'context';

@Entity({ name: 'memory' })
@Index(['companyId'])
@Index(['companyId', 'contactId'])
export class MemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'text' })
  type!: MemoryType;

  @Column({ type: 'text' })
  content!: string;
}
