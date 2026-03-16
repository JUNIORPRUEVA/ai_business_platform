import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

export type ChannelType =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'webchat'
  | 'telegram';

@Entity({ name: 'channels' })
@Index(['companyId'])
@Index(['companyId', 'type'])
export class ChannelEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  type!: ChannelType;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  config!: Record<string, unknown>;
}
