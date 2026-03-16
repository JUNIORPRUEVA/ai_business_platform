import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'plans' })
export class PlanEntity extends BaseEntity {
  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price!: string;

  @Column({ name: 'max_users', type: 'int' })
  maxUsers!: number;

  @Column({ name: 'max_bots', type: 'int' })
  maxBots!: number;

  @Column({ name: 'max_channels', type: 'int' })
  maxChannels!: number;
}
