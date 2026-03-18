import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChatCanonicalRecipient1774000000001 implements MigrationInterface {
  name = 'WhatsappChatCanonicalRecipient1774000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS canonical_remote_jid text NULL;`);
    await queryRunner.query(`ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS canonical_number text NULL;`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_company_canonical_number ON whatsapp_chats(company_id, canonical_number);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_company_canonical_remote ON whatsapp_chats(company_id, canonical_remote_jid);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_whatsapp_chats_company_canonical_remote;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_whatsapp_chats_company_canonical_number;`);

    await queryRunner.query(`ALTER TABLE whatsapp_chats DROP COLUMN IF EXISTS canonical_number;`);
    await queryRunner.query(`ALTER TABLE whatsapp_chats DROP COLUMN IF EXISTS canonical_remote_jid;`);
  }
}
