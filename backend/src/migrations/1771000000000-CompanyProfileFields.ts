import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyProfileFields1771000000000 implements MigrationInterface {
  name = 'CompanyProfileFields1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS website text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_line_1 text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_line_2 text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS state text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code text;');
    await queryRunner.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS description text;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS description;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS postal_code;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS country;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS state;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS city;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS address_line_2;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS address_line_1;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS tax_id;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS website;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS email;');
    await queryRunner.query('ALTER TABLE companies DROP COLUMN IF EXISTS phone;');
  }
}