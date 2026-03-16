import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'automations' })
@Index(['companyId'])
@Index(['companyId', 'trigger'])
export class AutomationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  trigger!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  config!: Record<string, unknown>;

  @Column({ type: 'text', default: 'active' })
  status!: string;
}
