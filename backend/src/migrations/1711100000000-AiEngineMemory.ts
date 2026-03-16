import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiEngineMemory1711100000000 implements MigrationInterface {
  name = 'AiEngineMemory1711100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversation_memory (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role text NOT NULL,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS conversation_memory_conversation_id_idx ON conversation_memory(conversation_id);',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contact_memory (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        key text NOT NULL,
        value text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS contact_memory_contact_id_idx ON contact_memory(contact_id);',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS contact_memory_contact_key_idx ON contact_memory(contact_id, key);',
    );

    await queryRunner.query(
      `ALTER TABLE bots ADD COLUMN IF NOT EXISTS system_prompt text NOT NULL DEFAULT '';`,
    );
    await queryRunner.query(
      `ALTER TABLE bots ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';`,
    );

    await queryRunner.query(
      `ALTER TABLE tools ADD COLUMN IF NOT EXISTS bot_id uuid NULL REFERENCES bots(id) ON DELETE CASCADE;`,
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS tools_bot_id_idx ON tools(bot_id);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS tools_bot_id_idx;');
    await queryRunner.query('ALTER TABLE tools DROP COLUMN IF EXISTS bot_id;');

    await queryRunner.query('ALTER TABLE bots DROP COLUMN IF EXISTS language;');
    await queryRunner.query('ALTER TABLE bots DROP COLUMN IF EXISTS system_prompt;');

    await queryRunner.query('DROP INDEX IF EXISTS contact_memory_contact_key_idx;');
    await queryRunner.query('DROP INDEX IF EXISTS contact_memory_contact_id_idx;');
    await queryRunner.query('DROP TABLE IF EXISTS contact_memory;');

    await queryRunner.query('DROP INDEX IF EXISTS conversation_memory_conversation_id_idx;');
    await queryRunner.query('DROP TABLE IF EXISTS conversation_memory;');
  }
}
