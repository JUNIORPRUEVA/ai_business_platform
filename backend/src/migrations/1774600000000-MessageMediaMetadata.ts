import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageMediaMetadata1774600000000 implements MigrationInterface {
  name = 'MessageMediaMetadata1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type text NULL;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name text NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS file_name;`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS mime_type;`);
  }
}
