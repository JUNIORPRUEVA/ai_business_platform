import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemoryArchitectureConsolidation1773200000000 implements MigrationInterface {
  name = 'MemoryArchitectureConsolidation1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE conversation_memory
      ADD COLUMN IF NOT EXISTS company_id uuid NULL,
      ADD COLUMN IF NOT EXISTS contact_id uuid NULL,
      ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'runtime',
      ADD COLUMN IF NOT EXISTS message_id uuid NULL,
      ADD COLUMN IF NOT EXISTS event_id text NULL,
      ADD COLUMN IF NOT EXISTS content_hash text NULL,
      ADD COLUMN IF NOT EXISTS compacted_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `);

    await queryRunner.query(`
      UPDATE conversation_memory memory
      SET
        company_id = conversation.company_id,
        contact_id = conversation.contact_id,
        source = CASE
          WHEN memory.role = 'assistant' THEN 'assistant_response'
          WHEN memory.role = 'system' THEN 'system_prompt'
          ELSE 'inbound_message'
        END,
        content_hash = md5(coalesce(memory.content, ''))
      FROM conversations conversation
      WHERE conversation.id = memory.conversation_id
        AND (memory.company_id IS NULL OR memory.contact_id IS NULL OR memory.content_hash IS NULL);
    `);

    await queryRunner.query(`
      ALTER TABLE conversation_memory
      ALTER COLUMN company_id SET NOT NULL,
      ALTER COLUMN contact_id SET NOT NULL,
      ALTER COLUMN content_hash SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_memory_company_id
      ON conversation_memory(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_memory_contact_id
      ON conversation_memory(company_id, contact_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_memory_conversation_created_at
      ON conversation_memory(company_id, conversation_id, created_at);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_memory_message_dedupe
      ON conversation_memory(company_id, source, message_id)
      WHERE message_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_memory_event_dedupe
      ON conversation_memory(company_id, source, event_id)
      WHERE event_id IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE contact_memory
      ADD COLUMN IF NOT EXISTS company_id uuid NULL,
      ADD COLUMN IF NOT EXISTS conversation_id uuid NULL,
      ADD COLUMN IF NOT EXISTS state_type text NOT NULL DEFAULT 'operational',
      ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `);

    await queryRunner.query(`
      UPDATE contact_memory memory
      SET company_id = contact.company_id
      FROM contacts contact
      WHERE contact.id = memory.contact_id
        AND memory.company_id IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE contact_memory
      ALTER COLUMN company_id SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_memory_company_id
      ON contact_memory(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_memory_company_contact
      ON contact_memory(company_id, contact_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_memory_company_contact_key
      ON contact_memory(company_id, contact_id, key);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        contact_id uuid NOT NULL,
        conversation_id uuid NOT NULL,
        summary_text text NOT NULL,
        key_facts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_message_id uuid NULL,
        summary_version integer NOT NULL DEFAULT 1,
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_summaries_unique_conversation
      ON conversation_summaries(company_id, conversation_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_summaries_contact
      ON conversation_summaries(company_id, contact_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_summaries_contact;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_summaries_unique_conversation;');
    await queryRunner.query('DROP TABLE IF EXISTS conversation_summaries;');

    await queryRunner.query('DROP INDEX IF EXISTS idx_contact_memory_company_contact_key;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_contact_memory_company_contact;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_contact_memory_company_id;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS updated_at;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS expires_at;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS metadata_json;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS state_type;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS conversation_id;');
    await queryRunner.query('ALTER TABLE contact_memory DROP COLUMN IF EXISTS company_id;');

    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_memory_event_dedupe;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_memory_message_dedupe;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_memory_conversation_created_at;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_memory_contact_id;');
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_memory_company_id;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS updated_at;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS compacted_at;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS content_hash;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS event_id;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS message_id;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS source;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS metadata_json;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS content_type;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS contact_id;');
    await queryRunner.query('ALTER TABLE conversation_memory DROP COLUMN IF EXISTS company_id;');
  }
}