import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'contact_memory' })
@Index(['contactId'])
@Index(['contactId', 'key'])
export class ContactMemoryEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}
