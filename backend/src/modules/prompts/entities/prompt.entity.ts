import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type PromptType = 'system' | 'behavior' | 'sales' | 'support';

@Entity({ name: 'prompts' })
@Index(['companyId'])
@Index(['companyId', 'type'])
export class PromptEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: PromptType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
