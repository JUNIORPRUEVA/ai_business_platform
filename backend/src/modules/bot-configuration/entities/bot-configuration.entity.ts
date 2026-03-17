import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { BotConfigurationBundle } from '../types/bot-configuration.types';

@Entity({ name: 'bot_configurations' })
@Index(['scope'], { unique: true })
export class BotConfigurationEntity extends BaseEntity {
  @Column({ type: 'text' })
  scope!: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload!: BotConfigurationBundle;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}