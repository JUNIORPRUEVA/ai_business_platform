import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'product_images' })
@Index(['companyId'])
@Index(['companyId', 'productId'])
export class ProductImageEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'text', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'text', name: 'content_type', nullable: true })
  contentType!: string | null;

  @Column({ type: 'text', name: 'alt_text', nullable: true })
  altText!: string | null;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
