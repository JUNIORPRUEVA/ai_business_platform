import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCatalog1774800000000 implements MigrationInterface {
  name = 'ProductCatalog1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        identifier text NOT NULL,
        name text NOT NULL,
        description text NULL,
        sales_price numeric(12,2) NOT NULL DEFAULT 0,
        offer_price numeric(12,2) NULL,
        discount_percent numeric(5,2) NULL,
        negotiation_allowed boolean NOT NULL DEFAULT false,
        negotiation_margin_percent numeric(5,2) NULL,
        currency text NOT NULL DEFAULT 'DOP',
        category text NULL,
        brand text NULL,
        benefits text NULL,
        availability_text text NULL,
        active boolean NOT NULL DEFAULT true,
        tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_company_identifier
      ON products(company_id, identifier);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_company_active
      ON products(company_id, active);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        product_id uuid NOT NULL,
        storage_key text NOT NULL,
        file_name text NOT NULL,
        content_type text NULL,
        alt_text text NULL,
        sort_order integer NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_product_images_company_product
      ON product_images(company_id, product_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_videos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        product_id uuid NOT NULL,
        title text NOT NULL,
        description text NULL,
        storage_key text NOT NULL,
        thumbnail_storage_key text NULL,
        file_name text NOT NULL,
        content_type text NULL,
        duration_seconds integer NULL,
        sort_order integer NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_product_videos_company_product
      ON product_videos(company_id, product_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS product_videos;');
    await queryRunner.query('DROP TABLE IF EXISTS product_images;');
    await queryRunner.query('DROP TABLE IF EXISTS products;');
  }
}
