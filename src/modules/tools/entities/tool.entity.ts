import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'tools' })
@Index(['companyId'])
export class ToolEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  config!: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
