import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'whatsapp_attachments' })
@Index(['companyId'])
@Index(['messageId'])
export class WhatsappAttachmentEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'message_id' })
  messageId!: string | null;

  @Column({ type: 'text', name: 'file_type' })
  fileType!: string;

  @Column({ type: 'text', name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'text', name: 'original_name', nullable: true })
  originalName!: string | null;

  @Column({ type: 'text', name: 'storage_path' })
  storagePath!: string;

  @Column({ type: 'text', name: 'public_url', nullable: true })
  publicUrl!: string | null;

  @Column({ type: 'bigint', name: 'size_bytes', nullable: true })
  sizeBytes!: string | null;

  @Column({ type: 'jsonb', name: 'metadata_json', default: () => `'{}'::jsonb` })
  metadataJson!: Record<string, unknown>;
}