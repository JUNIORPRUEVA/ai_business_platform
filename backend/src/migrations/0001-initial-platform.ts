import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPlatform0001 implements MigrationInterface {
  name = 'InitialPlatform0001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        plan text NOT NULL DEFAULT 'starter',
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name text NOT NULL,
        email text NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_company_email_unique UNIQUE (company_id, email)
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name text NOT NULL,
        model text NOT NULL,
        temperature double precision NOT NULL DEFAULT 0.2,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS bots_company_id_idx ON bots(company_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type text NOT NULL,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS channels_company_id_idx ON channels(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS channels_company_type_idx ON channels(company_id, type);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name text NULL,
        phone text NULL,
        email text NULL,
        tags text[] NOT NULL DEFAULT ARRAY[]::text[],
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON contacts(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS contacts_company_phone_idx ON contacts(company_id, phone);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
        contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS conversations_company_id_idx ON conversations(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS conversations_company_channel_idx ON conversations(company_id, channel_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS conversations_company_contact_idx ON conversations(company_id, contact_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender text NOT NULL,
        content text NOT NULL,
        type text NOT NULL DEFAULT 'text',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        type text NOT NULL,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS memory_company_id_idx ON memory(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS memory_company_contact_idx ON memory(company_id, contact_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name text NOT NULL,
        type text NOT NULL,
        content text NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS prompts_company_id_idx ON prompts(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS prompts_company_type_idx ON prompts(company_id, type);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name text NOT NULL,
        type text NOT NULL,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS tools_company_id_idx ON tools(company_id);');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        trigger text NOT NULL,
        action text NOT NULL,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS automations_company_id_idx ON automations(company_id);');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS automations_company_trigger_idx ON automations(company_id, trigger);');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS automations;');
    await queryRunner.query('DROP TABLE IF EXISTS tools;');
    await queryRunner.query('DROP TABLE IF EXISTS prompts;');
    await queryRunner.query('DROP TABLE IF EXISTS memory;');
    await queryRunner.query('DROP TABLE IF EXISTS messages;');
    await queryRunner.query('DROP TABLE IF EXISTS conversations;');
    await queryRunner.query('DROP TABLE IF EXISTS contacts;');
    await queryRunner.query('DROP TABLE IF EXISTS channels;');
    await queryRunner.query('DROP TABLE IF EXISTS bots;');
    await queryRunner.query('DROP TABLE IF EXISTS users;');
    await queryRunner.query('DROP TABLE IF EXISTS companies;');
  }
}
