import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'companies' })
export class CompanyEntity extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'starter' })
  plan!: string;

  @Column({ type: 'text', default: 'active' })
  status!: string;
}
