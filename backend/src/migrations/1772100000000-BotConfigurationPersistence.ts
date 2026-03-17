import { MigrationInterface, QueryRunner } from 'typeorm';

export class BotConfigurationPersistence1772100000000 implements MigrationInterface {
  name = 'BotConfigurationPersistence1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bot_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        scope text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_configurations_scope
      ON bot_configurations(scope);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS bot_configurations;');
  }
}