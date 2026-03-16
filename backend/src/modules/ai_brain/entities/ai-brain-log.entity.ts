import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'ai_brain_logs' })
@Index(['companyId'])
@Index(['companyId', 'conversationId'])
export class AiBrainLogEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'uuid', name: 'bot_id' })
  botId!: string;

  @Column({ type: 'uuid', name: 'channel_id' })
  channelId!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'text', name: 'detected_intent', nullable: true })
  detectedIntent!: string | null;

  @Column({ type: 'text', nullable: true })
  provider!: string | null;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'int', name: 'latency_ms', default: 0 })
  latencyMs!: number;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;
}