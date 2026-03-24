import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'product_videos' })
@Index(['companyId'])
@Index(['companyId', 'productId'])
export class ProductVideoEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'text', name: 'thumbnail_storage_key', nullable: true })
  thumbnailStorageKey!: string | null;

  @Column({ type: 'text', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'text', name: 'content_type', nullable: true })
  contentType!: string | null;

  @Column({ type: 'integer', name: 'duration_seconds', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
