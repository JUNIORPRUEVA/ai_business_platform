import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'companies' })
export class CompanyEntity extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true, name: 'phone' })
  phone!: string | null;

  @Column({ type: 'text', nullable: true, name: 'email' })
  email!: string | null;

  @Column({ type: 'text', nullable: true, name: 'website' })
  website!: string | null;

  @Column({ type: 'text', nullable: true, name: 'tax_id' })
  taxId!: string | null;

  @Column({ type: 'text', nullable: true, name: 'address_line_1' })
  addressLine1!: string | null;

  @Column({ type: 'text', nullable: true, name: 'address_line_2' })
  addressLine2!: string | null;

  @Column({ type: 'text', nullable: true, name: 'city' })
  city!: string | null;

  @Column({ type: 'text', nullable: true, name: 'state' })
  state!: string | null;

  @Column({ type: 'text', nullable: true, name: 'country' })
  country!: string | null;

  @Column({ type: 'text', nullable: true, name: 'postal_code' })
  postalCode!: string | null;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description!: string | null;

  @Column({ type: 'text', default: 'starter' })
  plan!: string;

  @Column({ type: 'text', default: 'active' })
  status!: string;
}
