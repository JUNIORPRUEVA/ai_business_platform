import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCatalogCommercialHardening1774900000000 implements MigrationInterface {
  name = 'ProductCatalogCommercialHardening1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS stock_quantity integer NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS low_stock_threshold integer NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS low_stock_threshold;
    `);
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS stock_quantity;
    `);
  }
}
