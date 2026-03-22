import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChatAutoReplyControl1774200000000
  implements MigrationInterface
{
  name = 'WhatsappChatAutoReplyControl1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "auto_reply_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_chats_company_auto_reply_enabled" ON "whatsapp_chats" ("company_id", "auto_reply_enabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_whatsapp_chats_company_auto_reply_enabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "auto_reply_enabled"`,
    );
  }
}