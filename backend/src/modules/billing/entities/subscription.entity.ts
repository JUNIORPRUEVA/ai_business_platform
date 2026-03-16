import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { PlanEntity } from './plan.entity';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';

@Entity({ name: 'subscriptions' })
export class SubscriptionEntity extends BaseEntity {
  @Column({ name: 'company_id', type: 'uuid', unique: true })
  companyId!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => PlanEntity, { eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity;

  @Column({ type: 'text' })
  status!: SubscriptionStatus;

  @Column({ name: 'paypal_subscription_id', type: 'text', nullable: true })
  paypalSubscriptionId!: string | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'renew_date', type: 'timestamptz' })
  renewDate!: Date;
}
