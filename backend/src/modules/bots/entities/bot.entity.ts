import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'bots' })
@Index(['companyId'])
export class BotEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'gpt-4o-mini' })
  model!: string;

  @Column({ type: 'double precision', default: 0.2 })
  temperature!: number;

  @Column({ type: 'text', default: 'active' })
  status!: string;
}
