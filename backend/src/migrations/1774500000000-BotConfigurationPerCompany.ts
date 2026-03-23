import { MigrationInterface, QueryRunner } from 'typeorm';

export class BotConfigurationPerCompany1774500000000 implements MigrationInterface {
  name = 'BotConfigurationPerCompany1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_configurations
      ADD COLUMN IF NOT EXISTS company_id uuid NULL;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bot_configurations_scope;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_configurations_company_id
      ON bot_configurations(company_id);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_configurations_company_scope
      ON bot_configurations(company_id, scope)
      WHERE company_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_configurations_global_scope
      ON bot_configurations(scope)
      WHERE company_id IS NULL;
    `);

    await queryRunner.query(`
      INSERT INTO bot_configurations (id, created_at, updated_at, company_id, scope, payload)
      SELECT
        gen_random_uuid(),
        now(),
        now(),
        companies.id,
        'default',
        template.payload
      FROM companies
      CROSS JOIN LATERAL (
        SELECT payload
        FROM bot_configurations
        WHERE company_id IS NULL AND scope = 'default'
        ORDER BY updated_at DESC
        LIMIT 1
      ) AS template
      WHERE NOT EXISTS (
        SELECT 1
        FROM bot_configurations existing
        WHERE existing.company_id = companies.id
          AND existing.scope = 'default'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM bot_configurations
      WHERE company_id IS NOT NULL AND scope = 'default';
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bot_configurations_company_scope;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bot_configurations_global_scope;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bot_configurations_company_id;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_configurations_scope
      ON bot_configurations(scope);
    `);

    await queryRunner.query(`
      ALTER TABLE bot_configurations
      DROP COLUMN IF EXISTS company_id;
    `);
  }
}
