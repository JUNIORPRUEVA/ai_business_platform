import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiBrainFoundation1772000000000 implements MigrationInterface {
  name = 'AiBrainFoundation1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;");

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_memories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        contact_id uuid NOT NULL,
        conversation_id uuid NULL,
        key text NOT NULL,
        value text NOT NULL,
        category text NOT NULL DEFAULT 'profile',
        confidence double precision NOT NULL DEFAULT 0.6,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_memories_company_id
      ON client_memories(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_memories_contact_id
      ON client_memories(company_id, contact_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_memories_key
      ON client_memories(company_id, contact_id, key);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        bot_id uuid NULL,
        name text NOT NULL,
        storage_key text NOT NULL,
        kind text NOT NULL DEFAULT 'document',
        content_type text NULL,
        size bigint NULL,
        status text NOT NULL DEFAULT 'ready',
        summary text NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_company_id
      ON knowledge_documents(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_bot_id
      ON knowledge_documents(company_id, bot_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_brain_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        company_id uuid NOT NULL,
        conversation_id uuid NOT NULL,
        contact_id uuid NOT NULL,
        bot_id uuid NOT NULL,
        channel_id uuid NOT NULL,
        status text NOT NULL,
        detected_intent text NULL,
        provider text NULL,
        model text NULL,
        latency_ms integer NOT NULL DEFAULT 0,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_brain_logs_company_id
      ON ai_brain_logs(company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_brain_logs_conversation_id
      ON ai_brain_logs(company_id, conversation_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS ai_brain_logs;');
    await queryRunner.query('DROP TABLE IF EXISTS knowledge_documents;');
    await queryRunner.query('DROP TABLE IF EXISTS client_memories;');
    await queryRunner.query('ALTER TABLE messages DROP COLUMN IF EXISTS metadata;');
  }
}