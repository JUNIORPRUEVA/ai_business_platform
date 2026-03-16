import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvolutionChannels1711200000000 implements MigrationInterface {
  name = 'EvolutionChannels1711200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "instance_name" text`);
    await queryRunner.query(
      `ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "connection_status" text NOT NULL DEFAULT 'disconnected'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_channels_instance_name" ON "channels" ("instance_name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channels_instance_name"`);
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "connection_status"`);
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "instance_name"`);
  }
}
