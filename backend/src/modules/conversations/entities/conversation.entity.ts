import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'conversations' })
@Index(['companyId'])
@Index(['companyId', 'channelId'])
@Index(['companyId', 'contactId'])
export class ConversationEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'channel_id' })
  channelId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'text', default: 'open' })
  status!: string;
}
