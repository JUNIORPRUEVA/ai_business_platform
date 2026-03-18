import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappChatIdentityHardening1774000000002 implements MigrationInterface {
  name = 'WhatsappChatIdentityHardening1774000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "original_remote_jid" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "raw_remote_jid" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "send_target" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "last_inbound_jid_type" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" ADD COLUMN IF NOT EXISTS "reply_target_unresolved" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_chats_company_send_target" ON "whatsapp_chats" ("company_id", "send_target")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_chats_company_reply_target_unresolved" ON "whatsapp_chats" ("company_id", "reply_target_unresolved")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_whatsapp_chats_company_reply_target_unresolved"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_whatsapp_chats_company_send_target"`,
    );

    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "reply_target_unresolved"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "last_inbound_jid_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "send_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "raw_remote_jid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_chats" DROP COLUMN IF EXISTS "original_remote_jid"`,
    );
  }
}
