import { MigrationInterface, QueryRunner } from 'typeorm';

export class VoiceNoteSupport1774100000000 implements MigrationInterface {
  name = 'VoiceNoteSupport1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text NULL;`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration integer NULL;`);

    await queryRunner.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS duration_seconds integer NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS duration_seconds;`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS duration;`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN IF EXISTS media_url;`);
  }
}