import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'products' })
@Index(['companyId'])
@Index(['companyId', 'identifier'], { unique: true })
@Index(['companyId', 'active'])
export class ProductEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({ type: 'text' })
  identifier!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'sales_price', default: 0 })
  salesPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'offer_price', nullable: true })
  offerPrice!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'discount_percent', nullable: true })
  discountPercent!: string | null;

  @Column({ type: 'boolean', name: 'negotiation_allowed', default: false })
  negotiationAllowed!: boolean;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'negotiation_margin_percent',
    nullable: true,
  })
  negotiationMarginPercent!: string | null;

  @Column({ type: 'text', default: 'DOP' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  brand!: string | null;

  @Column({ type: 'text', nullable: true })
  benefits!: string | null;

  @Column({ type: 'text', name: 'availability_text', nullable: true })
  availabilityText!: string | null;

  @Column({ type: 'integer', name: 'stock_quantity', nullable: true })
  stockQuantity!: number | null;

  @Column({ type: 'integer', name: 'low_stock_threshold', nullable: true })
  lowStockThreshold!: number | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  tags!: string[];

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
