import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappInstanceJid1774400000000 implements MigrationInterface {
  name = 'WhatsappInstanceJid1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS jid text NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE whatsapp_instances DROP COLUMN IF EXISTS jid;`,
    );
  }
}
