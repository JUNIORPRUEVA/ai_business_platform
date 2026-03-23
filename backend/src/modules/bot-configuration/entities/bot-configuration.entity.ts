import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { BotConfigurationBundle } from '../types/bot-configuration.types';

@Entity({ name: 'bot_configurations' })
@Index(['companyId'])
export class BotConfigurationEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'company_id' })
  companyId!: string | null;

  @Column({ type: 'text' })
  scope!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: BotConfigurationBundle;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
