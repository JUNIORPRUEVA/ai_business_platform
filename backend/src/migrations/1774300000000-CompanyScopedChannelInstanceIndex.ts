import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyScopedChannelInstanceIndex1774300000000 implements MigrationInterface {
  name = 'CompanyScopedChannelInstanceIndex1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_channels_company_instance_name" ON "channels" ("company_id", "instance_name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channels_company_instance_name"`);
  }
}